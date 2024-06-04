const express = require('express')
const app = express()
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Hello World!')
})


const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.mi2xoxt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const AllPeatsCategoryDB = client.db('LafsePeats').collection('PeatsAllCategory')
    const AdoptedrequestedDB = client.db('LafsePeats').collection('Adoptedrequested')
    const campaignPeatsDB = client.db('LafsePeats').collection('campaignPeats')
    app.get('/allCategory' , async (req,res)=>{
      const searchValue = req.query.search
      // console.log(req.query.search);
      options = {
        sort: { date:  -1 }
      };
      const searchQuery = {$regex : searchValue , $options : 'i'}
      let query = {adopted : false};
      if (searchValue) {
        query={...query , name:searchQuery }
      }
      // console.log(query);
      const result = await AllPeatsCategoryDB.find(query,options).toArray()
      res.send(result)
    })
    app.get("/allCategory/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await AllPeatsCategoryDB.findOne(query);
      res.send(result);
    });
    // ReQuested Page 
    app.get('/Adopted/request/:email', async (req,res)=>{
      const email = req.params.email;
      const query = {AddedEmail: email, requetsed:true, adopted:false}
      const result = await AdoptedrequestedDB.find(query).toArray()
      res.send(result)
    })

    app.patch('/adopted/requestedAccept/:id',async(req,res)=>{
      console.log('object');
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      // console.log(id);
      const updateAllCategory = {
        $set: {
          adopted:true
        },
      }
      const updateRequest = {
        $set: {
          requetsed:false
        },
      }
      // const result = await AdoptedrequestedDB.deleteOne(query)
      const update = await AdoptedrequestedDB.updateOne(query, updateAllCategory)
      const result = await AllPeatsCategoryDB.updateOne(query, updateRequest)
      console.log(result);
      res.send(update)
    })

    app.delete('/Adopted/request/:id', async (req,res)=>{
      const query = {_id: new ObjectId(req.params.id)}
      const result = await AdoptedrequestedDB.deleteOne(query)
      res.send(result)
    })
    app.post('/Adopted/request', async (req,res)=>{
      const data = req.body;
      const result = await AdoptedrequestedDB.insertOne(data)
      res.send(result)
    })
   

    // Dashborad releted api
    app.get('/myAdded/', async (req, res)=>{
      const id = req.query.id
      const email = req.query.email
      // console.log(email,id);
      let query = {}
      if(id){
        query ={_id : new ObjectId(id)}
      }
      if (email) {
         query = {'addedPerson.AddedPersonEmail': email}
      }
      const result = await AllPeatsCategoryDB.find(query).toArray()
      res.send(result)
    })
    app.patch('/updateMyaddedPets/:id', async (req,res)=>{
      const id = req.params.id;
      const data = req.body;
      const query = {_id : new ObjectId(id)}
      const updateDoc = {
        $set: {
          name:data.name,
          age:data.age,
          img:data.img,
          type:data.type,
          location:data.location,
          desription:data.description,
          desription2:data.description2
        }
      }
      const result = await AllPeatsCategoryDB.updateOne(query,updateDoc)
      res.send(result)
    })
    app.delete('/myAddedDelete/:id', async (req,res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await AllPeatsCategoryDB.deleteOne(query)
      res.send(result)
    })
    app.patch('/myAddedAdopt/:id', async (req,res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const updateDoc = {
        $set: {
          adopted:true
        },
      }
      const requestDB = await AdoptedrequestedDB.deleteOne(query)
      console.log(requestDB);
      const result = await AllPeatsCategoryDB.updateOne(query, updateDoc)
      res.send(result)
    })
    app.post('/AddPet', async (req,res)=>{
      const data = req.body;
      const result = await AllPeatsCategoryDB.insertOne(data)
      res.send(result)
    })
    // Campaign releted api 
    app.get('/campaignAllPeats', async (req,res) =>{
      // console.log('object');
      
      const result = await campaignPeatsDB.find().sort({date: -1 } ).toArray()
      res.send(result)
    })
    app.get("/campaignAllPeats/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await campaignPeatsDB.findOne(query);
      res.send(result);
    });

    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})