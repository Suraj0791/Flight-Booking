const express = require('express');

const { ServerConfig, Queue } = require('./config');
const apiRoutes = require('./routes');
const CRON = require('./utils/common/cron-jobs');


const app = express();



app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);
//this is for the proxy middleware in api-gateway bookisngervice will go to same apiroutes
app.use('/bookingService/api', apiRoutes);



app.listen(ServerConfig.PORT,async () => {
    console.log(`Successfully started the server on PORT : ${ServerConfig.PORT}`);
    CRON();
    await Queue.connectQueue();
    console.log("queue connected");
});
