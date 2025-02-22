require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { createServer } = require("http")
const { Server } = require("socket.io")
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
})

const PORT = process.env.PORT || 5000
app.use(express.json())
app.use(cors())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pcjdk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    await client.connect()
    console.log("Connected to MongoDB!")
    const taskCollection = client.db("Tasks").collection("Task")

    io.on("connection", (socket) => {
      console.log("A user connected")

      socket.on("disconnect", () => {
        console.log("User disconnected")
      })
    })

    // Fetch tasks
    app.get("/tasks", async (req, res) => {
      const result = await taskCollection.find().sort({ order: 1 }).toArray()
      res.send(result)
    })

    // Add task
    app.post("/tasks", async (req, res) => {
      const data = req.body
      const maxOrderTask = await taskCollection.findOne({ category: data.category }, { sort: { order: -1 } })
      const order = maxOrderTask ? maxOrderTask.order + 1 : 0
      const taskWithOrder = { ...data, order }
      const result = await taskCollection.insertOne(taskWithOrder)
      io.emit("taskAdded", result.ops[0])
      res.send(result)
    })

    // Delete task
    app.delete("/tasks/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await taskCollection.deleteOne(query)
      io.emit("taskDeleted", id)
      res.send(result)
    })

    // Update task
    app.put("/tasks/:id", async (req, res) => {
      const id = req.params.id
      const data = req.body
      const query = { _id: new ObjectId(id) }
      const updatedData = {
        $set: {
          title: data.title,
          description: data.description,
          category: data.category,
        },
      }
      const result = await taskCollection.updateOne(query, updatedData)
      io.emit("taskUpdated", { _id: id, ...data })
      res.send(result)
    })

    // Reorder tasks
    app.post("/tasks/reorder", async (req, res) => {
      const { category, taskIds } = req.body
      const bulkOps = taskIds.map((id, index) => ({
        updateOne: {
          filter: { _id: new ObjectId(id) },
          update: { $set: { order: index, category } },
        },
      }))
      const result = await taskCollection.bulkWrite(bulkOps)
      io.emit("tasksReordered", { category, taskIds })
      res.send(result)
    })
  } finally {
    // Uncomment the following line if you want to close the connection after each request
    // await client.close();
  }
}

run().catch(console.dir)

app.get("/", async (req, res) => {
  res.send("Tasks are Cooking")
})

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

