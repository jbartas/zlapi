const   mongoose = require('mongoose');
const   credentials = require("./credentials.js");

console.log("zldb.js: Connecting to database");
const dbUrl = 'mongodb://' + credentials.username +
        ':' + credentials.password + '@' + credentials.host + ':' + credentials.port + '/' + credentials.database;
console.log(dbUrl);

const connection = mongoose.createConnection(dbUrl, { useNewUrlParser: true } );

const   Schema = mongoose.Schema;
const   ObjectID = require('mongodb').ObjectID;

/* The basic per-user identity records.
*/
const zlUser = new Schema({
    email: String,
    userName: String,
    password: String,
    admin:  Boolean,     // true if Admin
    groups: Array
});


/* This defines the basic single link record.
 */
const zlLinks = new Schema({
    userName: String, 
    type: String,       // meal, supplement, exersize, mental, etc.
    name: String,       // Pizza, Vitamin C, Fish OIl
    amount: Number,     // number of units below
    units: String,      // name for units - Lds, mg, pints,
    clicks: Number,     // weighted popularity counter
    subActions: [],     // List if Ids of grouped actions
    btnColor: String,   
    details: String     // any notes the user wants to apply    
})



module.exports = {
    getzlUser: () => {
        return connection.model("zlUsers", zlUser);
    },

    getzlLinks: () => {
		return connection.model("zlLinks", zlLinks);
    },
    
}

 
