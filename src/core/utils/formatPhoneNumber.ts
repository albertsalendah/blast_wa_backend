export function formatPhoneNumber(countryCode: string, phoneNumber: string,) {
    // Remove any non-digit characters
    let cleanedNumber = phoneNumber.replace(/\D/g, '');

    // Check if the number starts with 0 and replace with country code
    if (cleanedNumber.startsWith('0')) {
        cleanedNumber = countryCode + cleanedNumber.substring(1);
    }

    // Check if the number already has the country code
    if (!cleanedNumber.startsWith(countryCode)) {
        cleanedNumber = countryCode + cleanedNumber;
    }

    // Check if the number ends with @s.whatsapp.net
    if (!cleanedNumber.endsWith('@s.whatsapp.net')) {
        cleanedNumber = cleanedNumber + '@s.whatsapp.net';
    }

    return cleanedNumber;
}