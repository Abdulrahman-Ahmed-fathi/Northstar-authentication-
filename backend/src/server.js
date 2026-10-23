import app from "./app.js";

const PORT = Number(process.env.PORT) || 5000;


const server = app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`)
})

// Shut down cleanly when the process is stopped.
function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);