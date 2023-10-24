export const phoneNumberFormatter = function (number: String) {
	let formatted = number.replace(/\D/g, '');

	if (formatted.startsWith('0')) {
		formatted = '62' + formatted.substr(1);
	}
	//@c.us
	if (!formatted.endsWith('@s.whatsapp.net')) {
		formatted += '@s.whatsapp.net';
	}

	return formatted;
}