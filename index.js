require("dotenv").config();
const express = require("express");
const app = express();

const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());
const port = 5000 || process.env.PORT;

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
    const usersCollections = db.collection("user");

    const usersSessionCollections = db.collection("session");
    const jobCollections = db.collection("job_data");
    const companiesCollections = db.collection("companies_data");
    const applyUserCollections = db.collection("apply_user");
    const plansCollections = db.collection("plans");
    const subscriptionsCollections = db.collection("subscriptions");

    const verifyToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({ message: "unauthorized access" });
      }
      const token = authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "unauthorized access" });
      }

      const query = { token };

      const session = await usersSessionCollections.findOne(query);
      if (!session) {
        return res.status(401).json({ message: "invalid session" });
      }
      const userId = session.userId;

      const user = await usersCollections.findOne({
        _id: new ObjectId(userId),
      });
      if (!user) {
        return res.status(401).json({ message: "user not found" });
      }
      req.user = user;
      next();
    };

    // must be used after verifyToken middleware
    const verifySeeker = async (req, res, next) => {
      if (req.user?.role !== "seeker") {
        return res.status(403).json({ message: "forbidden access" });
      }
      next();
    };

    // must be used after verifyToken middleware
    const veryfyAdmin = async (req, res, next) => {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          message: "forbidden access",
        });
      }
      next();
    };

    // must be used after verifyToken middleware
    const veryfyRecruiter = async (req, res, next) => {
      if (req.user.role !== "recruiter") {
        return res.status(403).json({
          message: "forbidden access",
        });
      }
      next();
    };

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

    app.post("/jobs", verifyToken, veryfyRecruiter, async (req, res) => {
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

    app.patch("/companies/:id", verifyToken, veryfyAdmin, async (req, res) => {
      const { id } = req.params;
      const updatedCompany = req.body;

      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          status: updatedCompany.status,
        },
      };

      const result = await companiesCollections.updateOne(filter, updateDoc);
      res.json(result);
    });

    app.get("/user-companies", async (req, res) => {
      const query = {};

      if (req.query.userId) {
        query.userId = req.query.userId;
      }

      const cursor = companiesCollections.find(query);
      const result = await cursor.toArray();
      res.json(result);
    });

    app.post("/companies", async (req, res) => {
      const post = req.body;
      const result = await companiesCollections.insertOne(post);
      res.json(result);
    });

    // apply user

    app.post("/applyuser", verifyToken, verifySeeker, async (req, res) => {
      const post = req.body;
      const result = await applyUserCollections.insertOne(post);
      res.json(result);
    });

    app.get("/applyuser", verifyToken, verifySeeker, async (req, res) => {
      const query = {};
      if (req.query.userId) {
        query.userId = req.query.userId;
      }

      if (req.query.userId && req.user._id.toString() !== req.query.userId) {
        return res.status(403).json({ message: "forbidden access" });
      }
      if (req.query.jobId) {
        query.jobId = req.query.jobId;
      }
      const cursor = applyUserCollections.find(query);
      const result = await cursor.toArray();

      res.json(result);
    });

    // plans
    app.get("/plans", async (req, res) => {
      const { plan_id } = req.query;

      if (!plan_id) {
        return res.status(400).json({ error: "plan_id is required" });
      }

      const result = await plansCollections.findOne({ plan_id });

      res.json(result);
    });

    app.post("/subcriptions", async (req, res) => {
      const data = req.body;
      const subsInfo = {
        ...data,
        createdAt: new Date(),
      };
      const result = await subscriptionsCollections.insertOne(subsInfo);

      // update the user plan information
      const filter = { email: data.email };
      const updateDocument = {
        $set: {
          plan: data.planId,
        },
      };
      const updateResult = await usersCollections.updateOne(
        filter,
        updateDocument,
      );

      res.json(result);
    });

    // get users
    app.get("/users", verifyToken, veryfyAdmin, async (req, res) => {
      const result = await usersCollections.find().toArray();
      res.json(result);
    });
    app.post("/users/:id", verifyToken, veryfyAdmin, async (req, res) => {
      const { id } = req.params;
      const role = req.body.role;

      const result = await usersCollections.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: { role },
        },
      );
      res.json(result);
    });

    app.get("/applications", async (req, res) => {
      const result = await applyUserCollections.find().toArray();
      res.json(result);
    });

    app.get("/all-jobs", async (req, res) => {
      const result = await jobCollections.find().toArray();
      res.json(result);
    });

    app.get("/subscriptions", verifyToken, veryfyAdmin, async (req, res) => {
      const result = await subscriptionsCollections.find().toArray();
      res.json(result);
    });

    // get retuiter`s company job applications

    app.get("/applications/:id", async (req, res) => {
      const { id } = req.params;

      const result = await applyUserCollections
        .find({ jobCreaterId: id })
        .toArray();
      res.json(result);
    });

    // update applications status
    app.patch("/applications/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      const result = await applyUserCollections.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            status,
          },
        },
      );
    
      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
