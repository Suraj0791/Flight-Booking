const { PrismaClient,Booking } = require('@prisma/client');
const prisma = new PrismaClient();
const { AppError } = require('../utils/errors/app-error'); 
const { StatusCodes } = require('http-status-codes');
const CrudRepository = require('./crud-repository');
const {Enums} = require('../utils/common');
const { CANCELLED, BOOKED } = Enums.BOOKING_STATUS;


class BookingRepository {
    async createBooking(data, transaction) {
        const response = await prisma.booking.create({
            data,
            ...(transaction && { transaction })
        });
        return response;
    }

    async createBooking(data, transaction) {
        const response = await Booking.create(data, {transaction: transaction});
        return response;
    } 

    async get(data, transaction) {
        const response = await Booking.findByPk(data, {transaction: transaction});
        if(!response) {
            throw new AppError('Not able to fund the resource', StatusCodes.NOT_FOUND);
        }
        return response;
    }

    async update(id, data, transaction) { // data -> {col: value, ....}
        const response = await Booking.update(data, {
            where: {
                id: id
            }
        }, {transaction: transaction});
        return response;
    }


    async cancelOldBookings(timestamp) {
        // Bookings created before this time will be considered for cancellation.
        const response = await prisma.booking.updateMany({
            where: {

                //where filters the record which are created before the timestamp and are not BOOKED or CANCELLED
                createdAt: { lt: timestamp },
                //excluding  BOOKED and CANCELLED status
                NOT: {
                    status: {
                        in: ['BOOKED', 'CANCELLED']
                    }
                }
            },

            //update the status of the filtered records to CANCELLED
            data: { status: 'CANCELLED' }
        });
        return response;
    }
}

module.exports = BookingRepository;
