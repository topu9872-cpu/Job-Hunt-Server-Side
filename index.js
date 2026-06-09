require("dotenv").config();
const express = require("express");
const app = express();

const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());
const port = 5000;

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("Job_Hunt");
    const jobCollections = db.collection("job_data");
    const companiesCollections = db.collection("companies_data");
    const applyUserCollections = db.collection("apply_user");

    app.get("/jobs", async (req, res) => {
      const search = req.query.search || "";
      const location = req.query.location || "";
      const page = parseInt(req.query.page) || 1;
      const limit = 9;
      const query = {};
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { company: { $regex: search, $options: "i" } },
        ];
      }

      if (location.trim()) {
        query.location = {
          $regex: location,
          $options: "i",
        };
      }
      const skip = (page - 1) * limit;
      const result = await jobCollections
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();
      const total = await jobCollections.countDocuments(query);
      res.json({
        data: result,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      });
    });

    app.get("/jobs/:id", async (req, res) => {
      const { id } = req.params;
      const result = await jobCollections.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.post("/jobs", async (req, res) => {
      const post = req.body;
      const result = await jobCollections.insertOne(post);
      res.json(result);
    });

    app.get("/dashboardjobs", async (req, res) => {
      const result = await jobCollections.find().toArray();
      res.json(result);
    });

    // companies data
    app.get("/companies", async (req, res) => {
      const search = req.query.search || "";
      const query =
        search && search.trim() !== ""
          ? {
              name: { $regex: search, $options: "i" },
            }
          : {};

      const result = await companiesCollections.find(query).toArray();
      res.json(result);
    });

    app.post("/companies", async (req, res) => {
      const post = req.body;
      const result = await companiesCollections.insertOne(post);
      res.json(result);
    });

    // apply user

    app.post("/applyuser", async (req, res) => {
      const post = req.body;
      const result = await applyUserCollections.insertOne(post);
      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
