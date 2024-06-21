// require(env).config()
const jwt = require("jsonwebtoken");
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Log the important environment variables to ensure they are being loaded
console.log('Stripe Secret Key:', process.env.STRIPE_SECRET_KEY ? 'Loaded' : 'Not Loaded');
console.log('MongoDB User:', process.env.USER_DB);
console.log('MongoDB Password:', process.env.USER_PASS);

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.mi2xoxt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    console.log("Connected to MongoDB");

    const userCollection = client.db("LafsePeats").collection("users");
    const HomeCollection = client.db("LafsePeats").collection("HomeData");
    const BanUsersCollection = client.db("LafsePeats").collection("banusers");
    const AllPeatsCategoryDB = client.db("LafsePeats").collection("PeatsAllCategory");
    const AdoptedrequestedDB = client.db("LafsePeats").collection("Adoptedrequested");
    const campaignPeatsDB = client.db("LafsePeats").collection("campaignPeats");

   //donation api
    // -------------------------------
    app.post('/create-payment-intent', async (req, res) => {
      try {
        const { donation } = req.body;
        if (!donation) {
          throw new Error('Donation amount is required');
        }
        
        const amount = parseInt(donation * 100);
        console.log('Amount:', amount);
    
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card'],
        });
    
        // console.log('Payment Intent:', paymentIntent);
    
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error('Error creating payment intent:', error.message);
        res.status(500).send({ error: error.message });
      }
    });
    


    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // Users releted api

    app.get("/users", verifyToken,verifyAdmin,  async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get("/homeData", async (req, res) => {
      const result = await HomeCollection.find().toArray();
      res.send(result);
    });


    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })

    // make admin
    app.patch("/users/admin/:id",verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
// ban Users api
    app.post("/users/ban", verifyToken,verifyAdmin, async (req, res) => {
      const banUser = req.body;
      const result = await BanUsersCollection.insertOne(banUser);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists:
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/allCategory", async (req, res) => {
      const searchValue = req.query.search;
      // console.log(req.query.search);
      options = {
        sort: { date: -1 },
      };
      const searchQuery = { $regex: searchValue, $options: "i" };
      let query = { adopted: false };
      if (searchValue) {
        query = { ...query, name: searchQuery };
      }
      // console.log(query);
      const result = await AllPeatsCategoryDB.find(query, options).toArray();
      res.send(result);
    });
    app.get("/allCategory/admin", verifyToken,verifyAdmin, async (req, res) => {
      const result = await AllPeatsCategoryDB.find().toArray();
      res.send(result);
    });
    app.get("/allCategory/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await AllPeatsCategoryDB.findOne(query);
      res.send(result);
    });
    app.delete("/allcategory/admin/delete/:id", verifyToken,verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await AllPeatsCategoryDB.deleteOne(query)
      res.send(result)
    })
    // ReQuested Page
    app.get("/Adopted/request/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { AddedEmail: email, requetsed: true, adopted: false };
      const result = await AdoptedrequestedDB.find(query).toArray();
      res.send(result);
    });

    app.patch("/adopted/requestedAccept/:id/:adoptId", verifyToken, async (req, res) => {
      console.log("object");
      const id = req.params.id;
      const id2 = req.params.adoptId;
      console.log(id, id2);
      const query = { _id: new ObjectId(id) };
      const query2 = { _id: new ObjectId(id2) };
      const updateAllCategory = {
        $set: {
          adopted: true,
        },
      };
      const updateRequest = {
        $set: {
          requetsed: false,
        },
      };
      const result = await AllPeatsCategoryDB.updateOne(
        query2,
        updateAllCategory
      );
      // console.log(result);
      const update = await AdoptedrequestedDB.updateOne(query, updateRequest);
      res.send(update);
    });

    app.delete("/Adopted/request/:id", verifyToken, async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await AdoptedrequestedDB.deleteOne(query);
      res.send(result);
    });
    app.post("/Adopted/request", async (req, res) => {
      const data = req.body;
      const result = await AdoptedrequestedDB.insertOne(data);
      res.send(result);
    });

    // Dashborad releted api
    app.get("/myAdded/", async (req, res) => {
      const id = req.query.id;
      const email = req.query.email;
      // console.log(email,id);
      let query = {};
      if (id) {
        query = { _id: new ObjectId(id) };
      }
      if (email) {
        query = { "addedPerson.AddedPersonEmail": email };
      }
      const result = await AllPeatsCategoryDB.find(query).toArray();
      res.send(result);
    });
    app.patch("/updateMyaddedPets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: data.name,
          age: data.age,
          img: data.img,
          type: data.type,
          location: data.location,
          desription: data.description,
          desription2: data.description2,
        },
      };
      const result = await AllPeatsCategoryDB.updateOne(query, updateDoc);
      res.send(result);
    });
    app.delete("/myAddedDelete/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const deleteRequest = await AdoptedrequestedDB.deleteMany({ id: id });
      const result = await AllPeatsCategoryDB.deleteOne(query);
      res.send(result);
    });
    app.patch("/myAddedAdopt/:id/:petId", verifyToken, async (req, res) => {
      const id = req.params.id;
      const petId = req.params.petId;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          adopted: true,
        },
      };
      const requestDB = await AdoptedrequestedDB.deleteMany({ id: id });
      // console.log(requestDB);
      const result = await AllPeatsCategoryDB.updateOne(query, updateDoc);
      res.send(result);
    });
    // Admin change status 
    app.patch("/AdminChangeStatusByAdopted/:id", verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          adopted: true,
        },
      };
      const result = await AllPeatsCategoryDB.updateOne(query, updateDoc);
      res.send(result);
    });
    app.patch("/AdminChangeStatusByNotAdopted/:id", verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          adopted: false,
        },
      };
      const result = await AllPeatsCategoryDB.updateOne(query, updateDoc);
      res.send(result);
    });


    // 
    app.post("/AddPet", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await AllPeatsCategoryDB.insertOne(data);
      res.send(result);
    });
    // Campaign releted api
    app.get("/campaignAllPeats",  async (req, res) => {
      const result = await campaignPeatsDB.find().sort({ date: -1 }).toArray();
      res.send(result);
    });
    app.get("/campaignAllPeats/admin", verifyToken,verifyAdmin, async (req, res) => {
      const result = await campaignPeatsDB.find().toArray();
      res.send(result);
    });
    app.patch("/Campaign/pause/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          pause: true,
        },
      };
      const result = await campaignPeatsDB.updateOne(query, updateDoc);
      res.send(result);
    });
    app.patch("/Campaign/Unpause/:id", verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          pause: false,
        },
      };
      const result = await campaignPeatsDB.updateOne(query, updateDoc);
      res.send(result);
    });
    app.patch("/myCampaignUpdate/:id", verifyToken, async (req, res) => {
      const updateId = req.params.id;
      const Updatedata = req.body;
      console.log("id", updateId);
      const query = { _id: new ObjectId(updateId) };
      const updateDoc = {
        $set: {
          image: Updatedata.image,
          date: Updatedata.date,
          name: Updatedata.name,
          maxDonation: Updatedata.maxDonation,
          sortDescription: Updatedata.sortDescription,
          longDescription: Updatedata.longDescription,
        },
      };
      const result = await campaignPeatsDB.updateOne(query, updateDoc);
      res.send(result);
    });
    app.get("/myAddedCampaign/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await campaignPeatsDB.find(query).toArray();
      res.send(result);
    });
    app.get("/myDonatePets/:email", async(req,res)=>{
      const email = req.params.email;
      const query = {'donators.email':email}
      const result = await campaignPeatsDB.find(query).toArray()
      res.send(result)
    })
    app.get("/campaignAllPeats/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await campaignPeatsDB.findOne(query);
      res.send(result);
    });
    app.delete("/ADmin/campaignAllPeats/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await campaignPeatsDB.deleteOne(query);
      res.send(result);
    });
    app.post("/Donation/campaign", verifyToken, async (req, res) => {
      const data = req.body;
      console.log(data);
      const result = await campaignPeatsDB.insertOne(data);
      res.send(result);
    });
    // Payment releted api
    app.patch('/campaigndonateUpdate/:id', async(req,res)=>{
      const id = req.params.id;
      const donateDetails = req.body;
      console.log(donateDetails);
      const query = {_id : new ObjectId(id)}
      const options = { upsert: true };
      const donationAmount = donateDetails.amount / 100;
      const updateDoc = {
        $inc: {
            donatedAmount:donationAmount
        },
        $push: {
            donators: {
                email: donateDetails.donate_person_email,
                name: donateDetails.donate_person_name,
                donate:donateDetails.danateMoney
            }
        }
    };
    const result = await campaignPeatsDB.updateOne(query, updateDoc, options)
    })
    app.patch('/refund/:id/:email', async (req,res)=>{
      const id = req.params.id;
      const email = req.params.email;
      const refundAmount = req.body.amount;
      console.log('kocu', id, email, refundAmount);

      const query = { _id: new ObjectId(id) };
    
      const updateDoc = {
        $inc: { donatedAmount: -refundAmount }, 
        $pull: { donators: { email: email } }
      };
      const result = await campaignPeatsDB.updateOne(query,updateDoc)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
