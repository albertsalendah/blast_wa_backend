export const phoneNumberFormatter = function (number: String) {
	let formatted = number.replace(/\D/g, '');

	if (formatted.startsWith('0')) {
		formatted = '670' + formatted.substr(1);
	}
	//@c.us
	if (!formatted.endsWith('@s.whatsapp.net')) {
		formatted += '@s.whatsapp.net';
	}

	return formatted;
}