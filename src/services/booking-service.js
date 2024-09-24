const axios = require('axios');
const { StatusCodes } = require('http-status-codes');
const { BookingRepository } = require('../repositories');
const { ServerConfig, Queue } = require('../config');
const AppError = require('../utils/errors/app-error');
const { Enums } = require('../utils/common');
const { BOOKED, CANCELLED } = Enums.BOOKING_STATUS;
const {PrismaClient} = require('@prisma/client');

const prisma = new PrismaClient();
const bookingRepository = new BookingRepository();

async function createBooking(data) {
    //Transaction banane se ensure hota hai ki agar koi bhi step fail hota hai toh pura transaction rollback ho jayega, aur koi bhi change db mein nahi hoga.
    return await prisma.$transaction(async (prisma) => {
        // Fetches the flight details using the flightId provided in the input data.
        const flight = await axios.get(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}`);
        const flightData = flight.data.data;

        // If the requested seats exceed the available seats, an error is thrown, and the transaction will be rolled back.
        if (data.noOfSeats > flightData.totalSeats) {
            throw new AppError('Not enough seats available', StatusCodes.BAD_REQUEST);
        }

        const totalBillingAmount = data.noOfSeats * flightData.price;
        // Uses the spread operator (...data) to include all properties from the data object (input that is flightID, userID, and noOfSeats in this case)
        // Adds a new property totalCost with the value of totalBillingAmount.
        const bookingPayload = { ...data, totalCost: totalBillingAmount };
        const booking = await bookingRepository.create(bookingPayload, prisma);


        // Updates the number of available seats in the flight service by sending a PATCH request to the /flights/:id/seats endpoint.
        await axios.patch(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}/seats`, {
            seats: data.noOfSeats
        });

        return booking;
    });
}

async function makePayment(data) {
    return await prisma.$transaction(async (prisma) => {
        // Fetches the booking details using the bookingId provided in the input data.
        const bookingDetails = await bookingRepository.get(data.bookingId, prisma);
        //agar booking status cancelled hai toh error throw karo
        if (bookingDetails.status == CANCELLED) {
            throw new AppError('The booking has expired', StatusCodes.BAD_REQUEST);
        }
        //check kro ki kahi booking 5 min se jyada purani toh nahi hai, agar hai toh cancel kardo. 300,000 milliseconds) have passed since it was created. 

        const bookingTime = new Date(bookingDetails.createdAt);
        const currentTime = new Date();
        if (currentTime - bookingTime > 300000) {
            await cancelBooking(data.bookingId);
            throw new AppError('The booking has expired', StatusCodes.BAD_REQUEST);
        }

        //booking amount aur payment amount match kar raha hai ya nahi
        if (bookingDetails.totalCost != data.totalCost) {
            throw new AppError('The amount of the payment doesn’t match', StatusCodes.BAD_REQUEST);
        }

        //user id match kar raha hai ya nahi
        //Ensures that the user making the payment is the same as the user who made the booking. If not, an error is thrown.

        if (bookingDetails.userId != data.userId) {
            throw new AppError('The user corresponding to the booking doesn’t match', StatusCodes.BAD_REQUEST);
        }
        // We assume here that payment is successful, so we update the booking status to BOOKED. 
        await bookingRepository.update(data.bookingId, { status: BOOKED }, prisma);
        Queue.sendData({
            recepientEmail: 'cs191297@gmail.com',
            subject: 'Flight booked',
            text: `Booking successfully done for the booking ${data.bookingId}`
        });

        return bookingDetails;
    });
}

async function cancelBooking(bookingId) {
    return await prisma.$transaction(async (prisma) => {
        // Fetches the booking details using the bookingId provided in the input data.
        //passing prisma bcz we are in transaction and we need to pass the same instance of prisma to all the queries in the transaction operation to ensure that it is part of the ongoing transaction. This ensures that all operations within the transaction are atomic and can be rolled back if any operation fails.
        const bookingDetails = await bookingRepository.get(bookingId, prisma);

        if (bookingDetails.status == CANCELLED) {
            return true;
        }
        // Updates the number of available seats in the flight service by sending a PATCH request to the /flights/:id/seats endpoint.
        await axios.patch(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${bookingDetails.flightId}/seats`, {
            seats: bookingDetails.noOfSeats,
            dec: 0
        });

        // Updates the booking status to CANCELLED.
        await bookingRepository.update(bookingId, { status: CANCELLED }, prisma);

        return bookingDetails;
    });
}

async function cancelOldBookings() {
    try {
        // We are using the cancelOldBookings function to cancel bookings that were created more than 5 minutes ago and are not in the BOOKED or CANCELLED status. This function is called periodically to ensure that old bookings are canceled automatically. This helps in managing the booking system efficiently and ensures that resources are not wasted on bookings that are no longer needed. const time = new Date(Date.now() - 1000 * 300); // time 5 mins ago this is the time 5 mins ago from the current time.
        const time = new Date(Date.now() - 1000 * 300); // time 5 mins ago
        //we are calucaltiong time 5 mins ago from now and passing it to the cancelOldBookings function to cancel bookings that were created more than 5 minutes ago.
        const response = await bookingRepository.cancelOldBookings(time);
        return response;
    } catch (error) {
        console.log(error);
    }
}

module.exports = {
    createBooking,
    makePayment,
    cancelBooking,
    cancelOldBookings
};