const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const objectId = require("mongodb").ObjectID;

const app = express();
const bodyParser = require("body-parser");

const port = process.env.PORT || 8080

const mongoClient = new MongoClient("mongodb://localhost:27017/", { useNewUrlParser: true, useUnifiedTopology: true });

let dbClient;

const mapTimer = new Map();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(function(req, res, next) {
    // do logging
    console.log('Something is happening.');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
    res.setHeader("Access-Control-Allow-Methods","PUT, POST, GET, DELETE, PATCH, OPTIONS");
    next(); // make sure we go to the next routes and don't stop here
});

//app.use(express.static(__dirname + "/public"));
app.get("/", function(req, res) {
    res.json({ message: "hooray! welcome to our api!" });
})

mongoClient.connect(function (err, client) {
    if (err) return console.log(err);
    dbClient = client;
    app.locals.collection = client.db("BikesRentalShop").collection("bikes");
    app.locals.collectionUsers = client.db("BikesRentalShop").collection("users");

    // app.locals.collectionUsers.insertOne({ name: "John Wick" }, function(err, result) {

    //     if (err) {
    //         console.log(err);
    //     }
    // })

    let bikes = [
        { name: "ИЖ «Юпитер»", type: "классический", price: "70", rented: true},
        { name: "Honda CBR1000RR Fireblade", type: "спортивный", price: "75", rented: true },
        { name: "Kawasaki KXF", type: "кроссовый", price: "100" },
        { name: "Harley-Davidson Fat Boy", type: "крузер", price: "150" },
        { name: "Урал-Днепр", type: "Чоппер", price: "50" }]

    // app.locals.collection.insertMany(bikes, function(err, result) {
    //     if (err) {
    //         console.log(err);
    //     }
    // })
    //  app.locals.collection.insertOne({ name: "test", type: "tes", price: "100.25", rented: true })

    app.listen(port, function () {
        console.log("Сервер ожидает подключения...");
    });
});

// получение списка байков в аренде
app.get("/api/bikes/rented", function (req, res) {

    const collection = req.app.locals.collection;
    collection.find({ rented: true }).toArray(function (err, bikes) {

        if (err) return console.log(err);
        //console.log(bikes)
        res.send(bikes)
    });
});

// получения списка доступных байков
app.get("/api/bikes/available", function (req, res) {

    const collection = req.app.locals.collection;
    collection.find({ $or: [{ rented: false }, { rented: undefined }] }).toArray(function (err, result) { //$or: [{rented: null}, {rented: undefined}]

        if (err) {
            console.log(err);
        }
        // console.log(result);
        res.send(result)
    })
}
);

// запись нового байка в базу данных
app.post("/api/bikes", function (req, res) {

    if (!req.body) return res.sendStatus(400);

    //console.log(req.body);
    const bikeName = req.body.name;
    const bikeType = req.body.type;
    const bikePrice = req.body.price;
    const bike = { name: bikeName, type: bikeType, price: bikePrice };

    const collection = req.app.locals.collection;
    collection.insertOne(bike, function (err, result) {

        if (err) return console.log(err);
        res.send(result.ops[0]);
    });
});

// снятие байка с аренды
app.put("/api/bikes/cancelRent", function (req, res) {

    if (!req.body) return res.sendStatus(400);
    const id = new objectId(req.body.id);
    const collection = req.app.locals.collection;

    collection.findOneAndUpdate({ _id: id }, { $set: { rented: false } },
        { returnOriginal: false }, function (err, result) {

            if (err) return console.log(err);
            const user = result.value;
            res.send(user);
        });
});

// аренда байка
app.put("/api/bikes/rent", function (req, res) {

    if (!req.body.id) return res.sendStatus(400);
    const id = new objectId(req.body.id);
    console.log(id);

    const collection = req.app.locals.collection;

    const isToLowerPrice = req.body.isToLowerPrice;
    //console.log(typeof req.body.isToLowerPrice);

    if (isToLowerPrice) {
        let timerId = setTimeout( () => {
        let newPrice;
        let p = collection.findOne({ _id: id }, function(err, result) {
            newPrice = +result.price / 2;
            collection.findOneAndUpdate({ _id: id }, { $set: { price: newPrice } },
                { returnOriginal: false }, function (err, result) {
        
                    if (err) return console.log(err);
                    console.log(result);
                })
        })
         }, /* timer expected */72000000//20 hours
        )
        mapTimer.set(id, timerId);
    }

    collection.findOneAndUpdate({ _id: id }, { $set: { rented: true, rentDate: req.body.rentDate } },
        { returnOriginal: false }, function (err, result) {

            if (err) return console.log(err);
            const user = result.value;
            res.send(user);
        });
});

// удаление байка из списка
app.delete("/api/bikes", function (req, res) {

    if (!req.body.id) res.sendStatus(400);

    const collection = req.app.locals.collection;
    const id = new objectId(req.body.id);

    collection.deleteOne({ _id: id }, function (err, result) {

        if (err) console.log(err);

        res.json({ message: `Bike with id ${id} is deleted!` });
    })
})

// прослушиваем прерывание работы программы (ctrl-c)
process.on("SIGINT", () => {
    dbClient.close();
    process.exit();
});