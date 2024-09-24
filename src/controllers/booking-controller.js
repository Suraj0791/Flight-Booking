const { StatusCodes } = require('http-status-codes');
const { BookingService } = require('../services');
const { SuccessResponse, ErrorResponse } = require('../utils/common');

async function createBooking(req, res) {
    try {
        console.log("body",req.body);
        const response = await BookingService.createBooking({
            flightId:parseInt( req.body.flightId),
            userId: parseInt(req.body.userId),
            noOfSeats: parseInt(req.body.noOfSeats)
        });
        SuccessResponse.data = response;
        return res
                .status(StatusCodes.OK)
                .json(SuccessResponse);
    } catch(error) {
        console.log("controller catching");
        console.log(error);
        ErrorResponse.error = error;
        return res
                .status(StatusCodes.INTERNAL_SERVER_ERROR)
                .json(ErrorResponse);
    }
}


//it is idempotent function, esnuring ki agar baarbaaar kli booking ka request daale fir bhi ek hi booking hogi
// This is crucial in scenarios where network issues or user actions might cause the same payment request to be sent multiple times.



async function makePayment(req, res) {
    try {
        //extracting the idempotency key from the request headers and checking if it exists . If it does not exist, we return a 400 Bad Request response. This key is a unique identifier for the payment request. It ensures that even if the same request is sent multiple times, it will be processed only once. 
        const idempotencyKey = req.headers['x-idempotency-key'];
        if(!idempotencyKey) {
            return res
                .status(StatusCodes.BAD_REQUEST)
                .json({message: 'idempotency key missing'});
        }
        //If it exists, we check if a payment with the same idempotency key already exists in the database. If a payment with the same idempotencyKey is found, it means that this payment request has already been processed successfully. In this case, the function returns a 400 Bad Request response with a message indicating that a retry on a successful payment is not allowed. This prevents duplicate payments from being processed
        const existingPayment = await prisma.payment.findUnique({
            where: { idempotencyKey }
        });
        if(existingPayment) {
            return res
                .status(StatusCodes.BAD_REQUEST)
                .json({message: 'Cannot retry on a successful payment'});
        }

        //If no payment with the same idempotency key is found, we proceed to create a new payment record in the database. We use the idempotency key to ensure that the payment is processed only once, even if the request is sent multiple times. If the payment is processed successfully, we return a 200 OK response with the payment details.
        const response = await prisma.payment.create({
            data: {
                totalCost: req.body.totalCost,
                userId: req.body.userId,
                bookingId: req.body.bookingId,
                idempotencyKey
            }
        });
        SuccessResponse.data = response;
        return res
                .status(StatusCodes.OK)
                .json(SuccessResponse);
            } catch(error) {
                console.log(error);
                ErrorResponse.error = error;
                return res
                        .status(StatusCodes.INTERNAL_SERVER_ERROR)
                        .json(ErrorResponse);
            }
        }
        

module.exports = {
    createBooking,
    makePayment
}