const { PrismaClient,Booking } = require('@prisma/client');
const prisma = new PrismaClient();
const { AppError } = require('../utils/errors/app-error'); 
const { StatusCodes } = require('http-status-codes');
const CrudRepository = require('./crud-repository');
const {Enums} = require('../utils/common');
const { CANCELLED, BOOKED } = Enums.BOOKING_STATUS;


class BookingRepository extends CrudRepository {
    constructor() {
        super(Booking);
    }


    async createBooking(data) {
        
        const response = await prisma.booking.create({
            data: data
        });
        return response;
    }
    

    async get(id, transaction) {
        const response = await transaction.booking.findUnique({
            where: {
                id: id
            }
        });
        if (!response) {
            throw new AppError('Not able to find the resource', StatusCodes.NOT_FOUND);
        }
        return response;
    }

    async update(id, data, transaction) {
        const response = await transaction.booking.update({
            where: {
                id: id
            },
            data: data
        });
        return response;
    }

    async cancelOldBookings(timestamp, transaction) {
        const response = await transaction.booking.updateMany({
            where: {
                AND: [
                    {
                        createdAt: {
                            lt: timestamp
                        }
                    },
                    {
                        status: {
                            notIn: ['BOOKED', 'CANCELLED']
                        }
                    }
                ]
            },
            data: {
                status: 'CANCELLED'
            }
        });
        return response;
    }
}

module.exports = BookingRepository;
