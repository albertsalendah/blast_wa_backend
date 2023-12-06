export const phoneNumberFormatter = function (kode_negara:String,number: String) {
	let formatted = number.replace(/\D/g, '');

	if (formatted.startsWith('0')) {
		formatted = kode_negara + formatted.substr(1);
	}
	//@c.us
	if (!formatted.endsWith('@s.whatsapp.net')) {
		formatted += '@s.whatsapp.net';
	}

	return formatted;
}