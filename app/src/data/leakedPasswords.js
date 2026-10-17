// A small bundled list of commonly breached passwords (13-login-signup.md rule 3).
// Compared case-insensitively. Only entries that could pass rules 1–2 (13+ characters
// with mixed case, digit and symbol) matter, plus a few classics for completeness.
export const leakedPasswords = new Set(
  [
    "Password1234!", "Password12345!", "Password123456!", "Password@12345", "Password!12345",
    "P@ssword12345", "P@ssw0rd12345!", "P@ssw0rd2024!!", "P@ssw0rd2025!!", "P@ssw0rd2026!!",
    "Welcome12345!", "Welcome@12345", "Welcome123456!", "Welcome2024!!!", "Welcome2025!!!",
    "Qwerty123456!", "Qwerty@123456", "Qwertyuiop123!", "Qwertyuiop@123", "Qwerty12345678!",
    "Letmein123456!", "Letmein@12345", "Iloveyou12345!", "Iloveyou@12345",
    "Admin12345678!", "Admin@1234567", "Administrator1!", "Administrator@1",
    "Changeme12345!", "ChangeMe@12345", "Summer2024!!!!", "Summer2025!!!!", "Winter2024!!!!",
    "Winter2025!!!!", "Spring2025!!!!", "Autumn2025!!!!", "January2025!!", "December2024!",
    "Football12345!", "Baseball12345!", "Basketball123!", "Sunshine12345!", "Princess12345!",
    "Dragon1234567!", "Monkey1234567!", "Master1234567!", "Shadow1234567!", "Superman12345!",
    "Batman12345678!", "Trustno1234567!", "Abc123456789!", "Abcdefg12345!", "Abcd@123456789",
    "Bitcoin12345!", "Bitcoin@12345", "Bitcoin2024!!!", "Crypto123456!", "Crypto@123456",
    "Ethereum12345!", "Satoshi12345!", "ToTheMoon123!", "Hodl12345678!",
    "Passw0rd!2345", "Passw0rd12345!", "MyPassword123!", "MyPassword@123", "Secret1234567!",
    "Login12345678!", "Default12345!", "Test12345678!", "Testing123456!", "Hello12345678!",
    "Freedom123456!", "Whatever12345!", "Computer12345!", "Internet12345!", "Starwars12345!",
    "password", "123456", "123456789", "qwerty", "password1", "12345678", "111111", "iloveyou",
  ].map((item) => item.toLowerCase()),
);
