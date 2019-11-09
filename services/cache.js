const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);

// instead of making a callback function
// return a promise function
client.get = util.promisify(client.get);

// how query work
// new query has 
// .find 
// .exec (execute)
// .limit ()

// add additonal some logic
const exec = mongoose.Query.prototype.exec;


// to prevent working exec function when you called by
// mongoose query. Because if we dont prevent, all data
// will be in cache...
mongoose.Query.prototype.cache = function() {
    this.useCache = true;
    // chainable function call (example: .find().cache())
    return this;
};

mongoose.Query.prototype.exec = async function() {
    if (!this.useCache) {
        return exec.apply(this, arguments);
    }
    // console.log('I am about to run a query');
    // this : Query

    // we generate key using getquery and collection name
    // console.log(this.getQuery());
    // console.log(this.mongooseCollection.name);

    // safely copy object to another object
    const key = JSON.stringify(
        Object.assign({}, this.getQuery(), {
            collection: this.mongooseCollection.name
        })
    );

    // See if we have a value for 'key' in redis

    const cacheValue = await client.get(key);

    // If we do,return that
    if (cacheValue) {
        // console.log(cacheValue);

        // cacheValue is an exact raw data. So We have to 
        // make a mongoose model such a get, set, validate etc.
        // we are making a data that known by mongoose
        // For example: new Blog({ title:'hi' content:'There'});
        // const doc = new this.model(JSON.parse(cacheValue));

        const doc = JSON.parse(cacheValue);

        return Array.isArray(doc) ?
            doc.map(d => new this.model(d)) :
            new this.model(doc);
    }

    // Otherwise, issue the query and store the result in redis
    // run original exec function
    const result = await exec.apply(this, arguments);

    // .exec returns Mongoose Documents( so we make return result)
    // Redis handles JSON
    client.get(key, JSON.stringify(result));
    return result;
};