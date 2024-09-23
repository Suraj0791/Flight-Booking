const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { AppError } = require('../utils/errors/app-error'); 
const { StatusCodes } = require('http-status-codes');
const BookingRepository=require('../repositories/booking-repository');
const axios = require('axios');
const {Enums} = require('../utils/common');
const { BOOKED, CANCELLED } = Enums.BOOKING_STATUS;

const ServerConfig = require('../config/server-config');

const bookingRepository = new BookingRepository();
const Booking=prisma.booking;


//booking ko transaction m krenge ham
async function createBooking(data) {
    const transaction = await prisma.$transaction(async (prisma) => {
        // Fetch flight details from the flight service
        const flight = await axios.get(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${parseInt(data.flightId)}`);
        

        const flightData = flight.data.data;
        console.log(flightData); // Add this to see the response format


        // Check if there are enough seats available
        if (data.noOfSeats > flightData.totalSeats) {
            throw new AppError('Not enough seats available', StatusCodes.BAD_REQUEST);
        }

        // Calculate the total billing amount
        const totalBillingAmount = data.noOfSeats * flightData.price;

        // Create the booking payload and insert into the database
        const bookingPayload = {
            ...data,
            totalCost: totalBillingAmount,
        };

        const booking = await prisma.booking.create({
            data: bookingPayload,
        });

        // Update seat count in flight service
        await axios.patch(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}/seats`, {
            seats: data.noOfSeats
        });

        // Return the created booking
        return booking;
    });

    return transaction;
}

module.exports = {
    createBooking
};


