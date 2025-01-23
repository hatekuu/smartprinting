const validateRegisterInput = (username, password, confirmPassword, secretKey) => {
    if (!username || !password || !confirmPassword || !secretKey) {
      return 'Tất cả các trường là bắt buộc';
    }
    if (password !== confirmPassword) {
      return 'Mật khẩu xác nhận không khớp';
    }
    return null;
  };
  
  const validateForgotPasswordInput = (username, secretKey, newPassword, confirmPassword) => {
    if (!username || !secretKey || !newPassword || !confirmPassword) {
      return 'Tất cả các trường là bắt buộc';
    }
    if (newPassword !== confirmPassword) {
      return 'Mật khẩu xác nhận không khớp';
    }
    return null;
  };
  
  module.exports = { validateRegisterInput, validateForgotPasswordInput };
  