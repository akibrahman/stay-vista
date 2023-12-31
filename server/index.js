const express = require("express");
const app = express();
const ssl = require("sslcommerz-lts");
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const cron = require("node-cron");
const port = process.env.PORT || 8000;

// middleware
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://hotelooo.web.app",
    "https://hotelooo.firebaseapp.com",
    "https://facebook.com",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.TTToken;
  console.log(token);
  if (!token) {
    return res.status(403).send({ message: "Unauthorized Access Here" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    //! Collections
    const dataBase = client.db("HoteloDB");
    const usersCollection = dataBase.collection("Users");
    const roomsCollection = dataBase.collection("Rooms");
    const bookingsCollection = dataBase.collection("Bookings");
    const paymentsCollection = dataBase.collection("Payments");
    const reviewsCollection = dataBase.collection("Reviews");
    const cancelCollection = dataBase.collection("Cancels");
    const refundCollection = dataBase.collection("Refunds");

    //!Cron Job
    app.post("/update-bookings", async (req, res) => {
      let totalBookings;
      let updatedCount = 0;
      const bookings = await bookingsCollection.find({}).toArray();
      totalBookings = bookings.length;

      for (const booking of bookings) {
        const thatDay = new Date(booking.startDate).toLocaleDateString(
          "en-GB",
          { timeZone: "Asia/Dhaka" }
        );
        const today = new Date().toLocaleDateString("en-GB", {
          timeZone: "Asia/Dhaka",
        });
        if (today == thatDay) {
          updatedCount++;
          console.log("This Booking will update now: ", booking);
          await bookingsCollection.updateOne(
            { _id: new ObjectId(booking._id) },
            { $set: { enjoyed: true } }
          );
        }
      }
      res.send({ totalBookings, updatedCount });
    });
    app.post("/boooooom", async () => {
      (await bookingsCollection.find().toArray()).map(async (book) => {
        await bookingsCollection.updateOne(
          { _id: book._id },
          { $set: { c_req: false, c_status: "processing" } }
        );
      });
      console.log("A Big Done");
    });

    //! Create Token by JWT
    app.post("/jwt", async (req, res) => {
      const user = await req.body;
      console.log("I need a new jwt", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res
        .cookie("TTToken", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    //! Remove Token
    app.get("/remove-jwt", async (req, res) => {
      console.log("Bug");
      try {
        res
          .clearCookie("TTToken", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Token removed successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    //! Save or modify user email, status in DB
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await req.body;
      const query = { email: email };
      const options = { upsert: true };
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        await usersCollection.updateOne(query, {
          $set: {
            name: user.name,
            photo: isExist.photo ? isExist.photo : user.photo,
            timestamp: new Date().toISOString(),
          },
        });
        res.send(isExist);
        return;
      }
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user, timestamp: Date.now() },
        },
        options
      );
      res.send(result);
    });
    //! Make Admin -admin
    app.post("/make-admin/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "admin" } }
      );
      res.send({ msg: "Done" });
    });
    //! Edit Profile - User
    app.post("/edit-profile/:id", verifyToken, async (req, res) => {
      console.log(req.params.id);
      console.log(await req.body);
      try {
        const data = await req.body;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          {
            $set: {
              name: data.name,
              age: data.age,
              photo: data.photo,
              phoneNumber: data.phoneNumber,
              address: data.address,
              bio: data.bio,
            },
          }
        );
        res.send(result);
      } catch (error) {
        res.send({ message: "Internal Server Error" });
      }
    });
    //! Get All User
    app.get("/all-users", verifyToken, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });
    //! Get user
    app.get("/user/:email", verifyToken, async (req, res) => {
      try {
        const user = await usersCollection.findOne({ email: req.params.email });
        res.send(user);
      } catch (error) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //! Add a Room
    app.post("/add-room", verifyToken, async (req, res) => {
      try {
        const data = await roomsCollection.insertOne(await req.body);
        res.send(data);
      } catch (error) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //! Edit a Room - Admin
    app.put("/edit-room/:id", verifyToken, async (req, res) => {
      try {
        const room = await req.body;
        const id = req.params.id;
        console.log(room, id);
        const query = { _id: new ObjectId(id) };
        const data = await roomsCollection.updateOne(query, {
          $set: {
            title: room.title,
            host: room.host,
            price: room.price,
            capacity: room.capacity,
            description: room.description,
            category: room.category,
            image: room.image,
            gallery: room.gallery,
            facilities: room.facilities,
          },
        });
        res.send(data);
      } catch (error) {
        res.status(501).send({ message: "Internal Server Error" });
      }
    });

    //! Get all Rooms from Database
    app.get("/all-rooms", async (req, res) => {
      const query = {};
      const result = await roomsCollection.find(query).toArray();
      res.send(result);
    });

    //! Get single Room from Database
    app.get("/room/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      res.send(result);
    });

    //! Get reservations for single room
    app.get("/reservation-data/:id", async (req, res) => {
      const id = req.params.id;
      const reservations = await bookingsCollection
        .find({ roomId: id })
        .toArray();
      res.send(reservations);
    });

    //! Like
    app.post("/like/:roomId/:userId", verifyToken, async (req, res) => {
      const roomId = req.params.roomId;
      const userId = req.params.userId;
      const query = { _id: new ObjectId(roomId) };
      const query2 = { _id: new ObjectId(userId) };
      await roomsCollection.updateOne(query, {
        $inc: { likes: 1 },
      });
      await usersCollection.updateOne(query2, { $push: { likings: roomId } });
    });

    //! DisLike
    app.post("/dislike/:roomId/:userId", verifyToken, async (req, res) => {
      const roomId = req.params.roomId;
      const userId = req.params.userId;
      const query = { _id: new ObjectId(roomId) };
      const query2 = { _id: new ObjectId(userId) };
      await roomsCollection.updateOne(query, {
        $inc: { likes: -1 },
      });
      await usersCollection.updateOne(query2, { $pull: { likings: roomId } });
    });

    //! Make Bookings
    app.post("/add-bookings", async (req, res) => {
      try {
        const prevUrlString = Object.keys(
          Object.fromEntries(new URLSearchParams(req.query).entries())
        )
          .map(
            (key) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(
                Object.fromEntries(new URLSearchParams(req.query).entries())[
                  key
                ]
              )}`
          )
          .join("&");
        const data = await req.body;
        const result = await bookingsCollection.insertOne({
          userId: data.userId,
          roomId: data.roomId,
          bookingDate: new Date().toISOString(),
          startDate: data.startDate,
          endDate: data.endDate,
          price: data.price,
          status: "due",
          enjoyed: false,
          reviewed: false,
          c_req: false,
          c_status: "processing",
        });
        const bookingId = result.insertedId.toString();
        const tran_id = new ObjectId().toString();
        const sslData = {
          total_amount: data.price,
          currency: "BDT",
          tran_id,
          success_url: `${process.env.SERVER_LINK}/payment-success/${tran_id}/${bookingId}/${data.userId}/${data.price}`,
          fail_url: `${process.env.SERVER_LINK}/payment-fail?${prevUrlString}&bookingId=${bookingId}`,
          cancel_url: "http://localhost:3030/cancel",
          ipn_url: "http://localhost:3030/ipn",
          shipping_method: "Courier",
          product_name: "Computer.",
          product_category: "Electronic",
          product_profile: "general",
          cus_name: "Customer Name",
          cus_email: "customer@example.com",
          cus_add1: "Dhaka",
          cus_add2: "Dhaka",
          cus_city: "Dhaka",
          cus_state: "Dhaka",
          cus_postcode: "1000",
          cus_country: "Bangladesh",
          cus_phone: "01711111111",
          cus_fax: "01711111111",
          ship_name: "Customer Name",
          ship_add1: "Dhaka",
          ship_add2: "Dhaka",
          ship_city: "Dhaka",
          ship_state: "Dhaka",
          ship_postcode: 1000,
          ship_country: "Bangladesh",
        };
        const sslcz = new ssl(
          process.env.SSL_STORE_ID,
          process.env.SSL_STORE_PASSWORD,
          false
        );
        const apiResponse = await sslcz.init(sslData);
        res.send({ url: apiResponse.GatewayPageURL });
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //! Payment Fail
    app.post("/payment-fail", async (req, res) => {
      const queryParams = new URLSearchParams(req.query);
      const data = Object.fromEntries(queryParams.entries());
      await bookingsCollection.deleteOne({ _id: new ObjectId(data.bookingId) });
      res.redirect(data.prevUrl + "?errorMsg=Payment-Failed");
    });

    //! Payment Success
    app.post(
      "/payment-success/:tranId/:bookingId/:userId/:amount",
      async (req, res) => {
        try {
          await paymentsCollection.insertOne({
            userId: req.params.userId,
            amount: parseFloat(req.params.amount),
            transactionId: req.params.tranId,
            bookingId: req.params.bookingId,
            paymentDate: new Date().toISOString(),
          });
          await bookingsCollection.updateOne(
            { _id: new ObjectId(req.params.bookingId) },
            {
              $set: {
                status: "paid",
              },
            }
          );
          //!
          const data1 = await bookingsCollection
            .aggregate([
              {
                $match: {
                  _id: new ObjectId(req.params.bookingId),
                },
              },
              {
                $addFields: {
                  userIdObj: {
                    $convert: {
                      input: "$userId",
                      to: "objectId",
                    },
                  },
                },
              },
              {
                $lookup: {
                  from: "Users",
                  localField: "userIdObj",
                  foreignField: "_id",
                  as: "user",
                },
              },
              {
                $unwind: "$user",
              },
              {
                $addFields: {
                  roomIdObj: {
                    $convert: {
                      input: "$roomId",
                      to: "objectId",
                    },
                  },
                },
              },
              {
                $lookup: {
                  from: "Rooms",
                  localField: "roomIdObj",
                  foreignField: "_id",
                  as: "room",
                },
              },
              {
                $unwind: "$room",
              },
            ])
            .toArray();
          //!
          const sslcz = new ssl(
            process.env.SSL_STORE_ID,
            process.env.SSL_STORE_PASSWORD,
            false
          );
          const data2 = await sslcz.transactionQueryByTransactionId({
            tran_id: req.params.tranId,
          });
          //!
          const mainData = {
            tran_id: req.params.tranId,
            name: data1[0].user.name,
            email: data1[0].user.email,
            roomName: data1[0].room.title,
            checkIn: data1[0].startDate,
            checkOut: data1[0].endDate,
            price: data1[0].price,
            tran_date: data2.element[0].tran_date,
            card_type: data2.element[0].card_type,
            bank_gw: data2.element[0].bank_gw,
            val_id: data2.element[0].val_id,
            status: data2.element[0].status,
            currency_type: data2.element[0].currency_type,
          };
          const queryString = Object.keys(mainData)
            .map(
              (key) =>
                `${encodeURIComponent(key)}=${encodeURIComponent(
                  mainData[key]
                )}`
            )
            .join("&");
          res.redirect(
            `${process.env.CLIENT_LINK}/payment-success/${req.params.tranId}?${queryString}`
          );
        } catch (error) {
          console.log(error);
          res.status(500).send({ message: "Internal Server Error" });
        }
      }
    );

    //! Get all or one Cancelation Requests - Admin
    app.get("/cancelation-reqs", verifyToken, async (req, res) => {
      const id = req.query.id;
      if (id) {
        const reqs = await cancelCollection
          .aggregate([
            {
              $match: {
                _id: new ObjectId(id),
              },
            },
            {
              $addFields: {
                userIdObj: {
                  $convert: {
                    input: "$userId",
                    to: "objectId",
                  },
                },
              },
            },
            {
              $addFields: {
                roomIdObj: {
                  $convert: {
                    input: "$roomId",
                    to: "objectId",
                  },
                },
              },
            },
            {
              $addFields: {
                bookingIdObj: {
                  $convert: {
                    input: "$bookingId",
                    to: "objectId",
                  },
                },
              },
            },
            {
              $lookup: {
                from: "Users",
                localField: "userIdObj",
                foreignField: "_id",
                as: "user",
              },
            },
            {
              $unwind: "$user",
            },
            {
              $lookup: {
                from: "Rooms",
                localField: "roomIdObj",
                foreignField: "_id",
                as: "room",
              },
            },
            {
              $unwind: "$room",
            },
            {
              $lookup: {
                from: "Bookings",
                localField: "bookingIdObj",
                foreignField: "_id",
                as: "booking",
              },
            },
            {
              $unwind: "$booking",
            },
            {
              $lookup: {
                from: "Payments",
                localField: "bookingId",
                foreignField: "bookingId",
                as: "payment",
              },
            },
            {
              $unwind: "$payment",
            },
          ])
          .toArray();
        console.log("With ID");
        res.send(reqs);
      } else {
        const reqs = await cancelCollection
          .aggregate([
            {
              $addFields: {
                userIdObj: {
                  $convert: {
                    input: "$userId",
                    to: "objectId",
                  },
                },
              },
            },
            {
              $addFields: {
                roomIdObj: {
                  $convert: {
                    input: "$roomId",
                    to: "objectId",
                  },
                },
              },
            },
            {
              $addFields: {
                bookingIdObj: {
                  $convert: {
                    input: "$bookingId",
                    to: "objectId",
                  },
                },
              },
            },
            {
              $lookup: {
                from: "Users",
                localField: "userIdObj",
                foreignField: "_id",
                as: "user",
              },
            },
            {
              $unwind: "$user",
            },
            {
              $lookup: {
                from: "Rooms",
                localField: "roomIdObj",
                foreignField: "_id",
                as: "room",
              },
            },
            {
              $unwind: "$room",
            },
            {
              $lookup: {
                from: "Bookings",
                localField: "bookingIdObj",
                foreignField: "_id",
                as: "booking",
              },
            },
            {
              $unwind: "$booking",
            },
            {
              $lookup: {
                from: "Payments",
                localField: "bookingId",
                foreignField: "bookingId",
                as: "payment",
              },
            },
            {
              $unwind: "$payment",
            },
          ])
          .toArray();
        console.log("Without ID");
        res.send(reqs);
      }
    });

    //! Approve Cancelation
    app.post(
      "/approve-cancelation/:bookingId/:tranId/:userId/:reqId",
      verifyToken,
      async (req, res) => {
        try {
          //Status Upgration of Booking
          const bookingId = req.params.bookingId;
          const userId = req.params.userId;
          const tranId = req.params.tranId;
          const reqId = req.params.reqId;
          await paymentsCollection.updateOne(
            {
              transactionId: tranId,
            },
            {
              $set: {
                status: "refunded",
              },
            }
          );
          await bookingsCollection.updateOne(
            { _id: new ObjectId(bookingId) },
            {
              $set: {
                c_status: "approved",
              },
            }
          );
          // Initiate Refund
          const sslcz = new ssl(
            process.env.SSL_STORE_ID,
            process.env.SSL_STORE_PASSWORD,
            false
          );
          const tranData = await sslcz.transactionQueryByTransactionId({
            tran_id: tranId,
          });
          console.log(tranData);
          const refundData = {
            refund_amount: parseFloat(tranData.element[0].currency_amount),
            refund_remarks: "Test",
            bank_tran_id: tranData.element[0].bank_tran_id,
            refe_id: "TestRefId",
          };
          const { bank_tran_id, trans_id, refund_ref_id } =
            await sslcz.initiateRefund(refundData);
          const refundResData = {
            refundDate: new Date().toISOString(),
            userId,
            bookingId,
            bank_tran_id,
            trans_id,
            refund_ref_id,
            amount: parseFloat(tranData.element[0].currency_amount),
          };
          await refundCollection.insertOne(refundResData);
          await cancelCollection.updateOne(
            { _id: new ObjectId(reqId) },
            { $set: { status: "resolved" } }
          );
          res.send({ message: "All Done" });
        } catch (error) {
          console.log(error);
          res.send({ message: "Internal Server Error" });
        }
      }
    );
    //! Decline Cancelation
    app.post(
      "/decline-cancelation/:bookingId/:reqId",
      verifyToken,
      async (req, res) => {
        try {
          const bookingId = req.params.bookingId;
          const reqId = req.params.reqId;
          await cancelCollection.updateOne(
            { _id: new ObjectId(reqId) },
            { $set: { status: "resolved" } }
          );
          await bookingsCollection.updateOne(
            { _id: new ObjectId(bookingId) },
            {
              $set: {
                c_status: "declined",
              },
            }
          );
          res.send({ message: "All Done" });
        } catch (error) {
          console.log(error);
          res.send({ message: "Internal Server Error" });
        }
      }
    );
    app.post("/refund-query", (req, res) => {
      const data = {
        refund_ref_id: "659a4299811be",
      };
      const sslcz = new ssl(
        process.env.SSL_STORE_ID,
        process.env.SSL_STORE_PASSWORD,
        false
      );
      sslcz.refundQuery(data).then((data) => {
        console.log(data);
        res.send(data.status);
      });
    });
    //! Get all Bookings - Admin
    app.get("/all-bookings-admin", verifyToken, async (req, res) => {
      try {
        const bookings = await bookingsCollection
          .aggregate([
            {
              $addFields: {
                userIdObj: {
                  $convert: {
                    input: "$userId",
                    to: "objectId",
                  },
                },
              },
            },
            {
              $addFields: {
                roomIdObj: {
                  $convert: {
                    input: "$roomId",
                    to: "objectId",
                  },
                },
              },
            },
            {
              $lookup: {
                from: "Users",
                localField: "userIdObj",
                foreignField: "_id",
                as: "user",
              },
            },
            {
              $unwind: "$user",
            },
            {
              $lookup: {
                from: "Rooms",
                localField: "roomIdObj",
                foreignField: "_id",
                as: "room",
              },
            },
            {
              $unwind: "$room",
            },
          ])
          .sort({ _id: -1 })
          .toArray();
        res.send(bookings);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });
    //! Get My Bookings
    app.get("/my-bookings/:userId", async (req, res) => {
      try {
        const userId = req.params.userId;
        const bookings = await bookingsCollection
          .aggregate([
            {
              $match: { userId },
            },
            {
              $addFields: {
                roomIdObj: {
                  $convert: {
                    input: "$roomId",
                    to: "objectId",
                  },
                },
              },
            },
            {
              $lookup: {
                from: "Rooms",
                localField: "roomIdObj",
                foreignField: "_id",
                as: "room",
              },
            },
            {
              $unwind: "$room",
            },
          ])
          .sort({ _id: -1 })
          .toArray();
        res.send(bookings);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //! Get All Payments - Admin
    app.get("/all-payments-admin", async (req, res) => {
      try {
        const payments = await paymentsCollection.aggregate([]).toArray();
        res.send(payments);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });
    //! Get My Payments
    app.get("/my-payments/:userId", async (req, res) => {
      try {
        const userId = req.params.userId;
        console.log(userId);
        const payments = await paymentsCollection
          .aggregate([
            {
              $match: { userId },
            },
          ])
          .toArray();
        res.send(payments);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //!Get One Payment Details
    app.get("/payment-details/:tranId", async (req, res) => {
      try {
        const sslcz = new ssl(
          process.env.SSL_STORE_ID,
          process.env.SSL_STORE_PASSWORD,
          false
        );
        const data = await sslcz.transactionQueryByTransactionId({
          tran_id: req.params.tranId,
        });
        res.send(data);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //!Get One Booking Details
    app.get("/booking-details/:bookingId", async (req, res) => {
      try {
        const booking = await bookingsCollection
          .aggregate([
            {
              $match: {
                _id: new ObjectId(req.params.bookingId),
              },
            },
            {
              $addFields: {
                roomIdObj: {
                  $convert: {
                    input: "$roomId",
                    to: "objectId",
                  },
                },
              },
            },
            {
              $addFields: {
                userIdObj: {
                  $convert: {
                    input: "$userId",
                    to: "objectId",
                  },
                },
              },
            },
            {
              $lookup: {
                from: "Users",
                localField: "userIdObj",
                foreignField: "_id",
                as: "user",
              },
            },
            {
              $unwind: "$user",
            },
            {
              $lookup: {
                from: "Rooms",
                localField: "roomIdObj",
                foreignField: "_id",
                as: "room",
              },
            },
            {
              $unwind: "$room",
            },
          ])
          .toArray();
        res.send(booking);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //! Post a cancel Request
    app.post("/rais-cancel", async (req, res) => {
      try {
        const reason = await req.body;
        const result = await cancelCollection.insertOne(reason);
        await bookingsCollection.updateOne(
          { _id: new ObjectId(reason.bookingId) },
          { $set: { c_req: true } }
        );
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //! Post a Review
    app.post("/post-review", async (req, res) => {
      try {
        const review = await req.body;
        const result = await reviewsCollection.insertOne(review);
        await bookingsCollection.updateOne(
          { _id: new ObjectId(review.bookingId) },
          { $set: { reviewed: true } }
        );
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //! Get Reviews
    app.get("/reviews/:roomId", verifyToken, async (req, res) => {
      const roomId = req.params.roomId;
      const reviews = await reviewsCollection
        .aggregate([
          {
            $match: {
              roomId,
            },
          },
          {
            $addFields: {
              userIdObj: {
                $convert: {
                  input: "$userId",
                  to: "objectId",
                },
              },
            },
          },
          {
            $lookup: {
              from: "Users",
              localField: "userIdObj",
              foreignField: "_id",
              as: "user",
            },
          },
          {
            $unwind: "$user",
          },
        ])
        .toArray();
      res.send(reviews);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Hotelo Server..");
});

app.listen(port, () => {
  console.log(`Hotelo is running on port ${port}`);
});
