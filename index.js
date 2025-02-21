require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;
app.use(express.json());
app.use(cors());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pcjdk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect()
    // console.log("Connected to MongoDB!")
    const taskCollection = client.db('Tasks').collection('Task');

    // Fetch tasks
    app.get('/tasks', async (req, res) => {
      const result = await taskCollection.find().sort({ order: 1 }).toArray();
      res.send(result);
    });

    // Add task
    app.post('/tasks', async (req, res) => {
      const data = req.body;
      const maxOrderTask = await taskCollection.findOne({ category: data.category }, { sort: { order: -1 } });
      const order = maxOrderTask ? maxOrderTask.order + 1 : 0;
      const taskWithOrder = { ...data, order };
      const result = await taskCollection.insertOne(taskWithOrder);
      res.send(result);
    });

    // Delete task
    app.delete('/tasks/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await taskCollection.deleteOne(query);
      res.send(result);
    });

    // Update task
    app.put('/tasks/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedData = {
        $set: {
          title: data.title,
          description: data.description,
          category: data.category,
          timestamp: new Date().toLocaleDateString(),
        },
      };
      const result = await taskCollection.updateOne(query, updatedData);
      res.send(result);
    });

    // Reorder tasks
    app.post('/tasks/reorder', async (req, res) => {
      const { category, taskIds } = req.body;
      const bulkOps = taskIds.map((id, index) => ({
        updateOne: {
          filter: { _id: new ObjectId(id) },
          update: { $set: { order: index, category } },
        },
      }));
      const result = await taskCollection.bulkWrite(bulkOps);
      res.send(result);
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', async (req, res) => {
  res.send('Tasks are Cooking');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
