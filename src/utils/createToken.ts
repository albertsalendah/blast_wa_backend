import axios from 'axios';
import { token } from '../models/tokenschema';
import cron from 'node-cron'
import { format } from 'date-fns';
export async function createNewToken() {
	const currentDate = format(new Date(), 'EEE, dd MMM yyyy');//new Date().toUTCString();
	console.log(currentDate);
	try {

		const deletedTokens = await token.deleteMany({ expires: { $lt: currentDate } }).exec();
		console.log('Deleted expired tokens:', deletedTokens.deletedCount);
		const existingToken = await token.findOne().sort({ _id: -1 }).exec();
		if (!existingToken) {
			console.log('Created new token');
			const apiUrl = 'https://app.uksw.edu/divprom/token';
			const bodyParams = {
				username: 'divprom',
				password: 'ytUijres',
				grant_type: 'password',
			};

			const response = await axios.post(apiUrl, bodyParams, {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			});

			const newToken = {
				access_token: response.data['access_token'],
				token_type: response.data['token_type'],
				expires_in: response.data['expires_in'],
				issued: response.data['.issued'],
				expires: response.data['.expires']
			};

			const createdToken = await token.create(newToken);
			console.log('Created new token:', createdToken);
		} else {
			console.log('Existing token still valid:', existingToken);
		}
	} catch (err) {
		console.error('Error deleting expired tokens or creating new token:', err);
		cron.schedule('*/3 * * * *', function () {
			console.log("Retrying Create Token, reconnecting....");
			createNewToken()
		})
	}
}



