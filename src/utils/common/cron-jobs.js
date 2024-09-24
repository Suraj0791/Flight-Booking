const cron = require('node-cron');

// uses node-cron to schedule a task that runs every 5 minutes to cancel old bookings.
//A cron file is typically used to define scheduled tasks that run at specified intervals. In the context of a Node.js application, a cron file is often used to set up and manage these scheduled tasks using a library like node-cron.

//The scheduleCrons function is used to schedule a task that runs every 5 minutes and calls the cancelOldBookings method from the BookingService. This method cancels all bookings that are older than 30 minutes.

const { BookingService } = require('../../services');

//Use node-cron to schedule a task that runs every 5 minutes and calls the cancelOldBookings method from the BookingService.
//This method cancels all bookings that are older than 30 minutes.

function scheduleCrons() {
    cron.schedule('*/5 * * * *', async () => {
        await BookingService.cancelOldBookings();
    });
}

module.exports = scheduleCrons;