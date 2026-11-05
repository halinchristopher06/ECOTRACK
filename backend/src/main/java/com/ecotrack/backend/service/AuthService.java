package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.AdminUserResponse;
import com.ecotrack.backend.dto.LoginRequest;
import com.ecotrack.backend.dto.LoginResponse;
import com.ecotrack.backend.dto.MessageResponse;
import com.ecotrack.backend.dto.ProfileResponse;
import com.ecotrack.backend.dto.SendLoginOtpRequest;
import com.ecotrack.backend.dto.SendLoginOtpResponse;
import com.ecotrack.backend.dto.SignupRequest;
import com.ecotrack.backend.dto.SignupResponse;
import com.ecotrack.backend.dto.UpdateProfileRequest;
import com.ecotrack.backend.dto.ForgotPasswordRequest;
import com.ecotrack.backend.dto.ResetPasswordRequest;
import com.ecotrack.backend.dto.VerifyLoginOtpResponse;
import com.ecotrack.backend.dto.VerifyLoginOtpRequest;
import com.ecotrack.backend.dto.VerifyOtpRequest;
import com.ecotrack.backend.exception.ApiException;
import com.ecotrack.backend.model.CompanyInfo;
import com.ecotrack.backend.model.HistoryRecord;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.model.UserRole;
import com.ecotrack.backend.model.UserSummary;
import com.ecotrack.backend.repository.HistoryRepository;
import com.ecotrack.backend.repository.UserRepository;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class AuthService {

    private static final String DEFAULT_ADMIN_EMAIL = "admin@ecotrack.com";
    private static final String DEFAULT_ADMIN_PASSWORD = "Admin@123";
    private static final long OTP_TTL_MINUTES = 10;
    private static final int MIN_PASSWORD_LENGTH = 8;
    /** BCrypt only hashes the first 72 bytes, so silently ignoring anything past that is worse than rejecting it. */
    private static final int MAX_PASSWORD_LENGTH = 72;
    /**
     * Minimum gap between two OTP sends for the same email + flow. Shorter than the frontend's
     * 60s resend countdown, so it only ever absorbs duplicate/rapid clicks and never blocks a
     * legitimate resend once the user has waited out the countdown.
     */
    private static final long OTP_RESEND_MIN_INTERVAL_SECONDS = 30;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final UserRepository userRepository;
    private final HistoryRepository historyRepository;
    private final Map<String, String> sessions = new ConcurrentHashMap<>();
    /** email+flow -> last OTP dispatch time, used to stop duplicate OTPs from rapid re-clicks. */
    private final Map<String, Instant> otpSentAt = new ConcurrentHashMap<>();
    private final EmailService emailService;
    private final Duration mailConfirmWindow;
    private final boolean demoFallbackEnabled;
    private final boolean databaseResetEnabled;

    public AuthService(
            EmailService emailService,
            UserRepository userRepository,
            HistoryRepository historyRepository,
            @Value("${otp.demo-fallback-enabled:true}") boolean demoFallbackEnabled,
            @Value("${database.reset-on-startup:false}") boolean databaseResetEnabled,
            @Value("${app.mail.confirm-timeout-seconds:6}") long mailConfirmTimeoutSeconds
    ) {
        this.emailService = emailService;
        this.userRepository = userRepository;
        this.historyRepository = historyRepository;
        this.demoFallbackEnabled = demoFallbackEnabled;
        this.databaseResetEnabled = databaseResetEnabled;
        this.mailConfirmWindow = Duration.ofSeconds(Math.max(1, mailConfirmTimeoutSeconds));
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (databaseResetEnabled) {
            try {
                userRepository.deleteAll();
                historyRepository.deleteAll();
                System.out.println("DATABASE RESET: All existing users and history have been cleared.");
            } catch (Exception e) {
                System.err.println("DATABASE RESET FAILED: " + e.getMessage());
            }
        }
        initAdminUser();
    }

    private void initAdminUser() {
        try {
            List<UserAccount> admins = userRepository.findAllByEmail(DEFAULT_ADMIN_EMAIL);
            if (admins.isEmpty()) {
                UserAccount admin = new UserAccount(
                        "EcoTrack Administrator",
                        DEFAULT_ADMIN_EMAIL,
                        passwordEncoder.encode(DEFAULT_ADMIN_PASSWORD),
                        UserRole.ADMIN,
                        new CompanyInfo("EcoTrack HQ")
                );
                admin.setVerified(true);
                saveUser(admin);
                addHistory(admin, "ADMIN_BOOTSTRAPPED");
                System.out.println("Admin user bootstrapped successfully.");
            }
        } catch (Exception e) {
            System.err.println("Warning: Could not check/bootstrap admin user on startup. " + e.getMessage());
        }
    }

    public SignupResponse signup(SignupRequest request) {
        String email = normalizeEmail(request.email());
        if (!email.matches("^[A-Za-z0-9+_.-]+@(.+)$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        }
        requireValidPassword(request.password(), "Password");

        List<UserAccount> users = userRepository.findAllByEmail(email);
        UserAccount user;
        
        if (!users.isEmpty()) {
            user = users.get(0);
            if (user.isVerified()) {
                throw new ApiException(HttpStatus.CONFLICT, "This email is already registered. Please sign in.");
            }
            // If not verified, update details and resend OTP
            user.setFullName(request.fullName().trim());
            user.setPasswordHash(passwordEncoder.encode(request.password()));
            // Self-service sign-up may only ever create a customer account. Admin access is
            // provisioned by the server (see initAdminUser), so the role sent by the client is
            // ignored — otherwise anyone could register themselves as an administrator.
            user.setRole(UserRole.CUSTOMER);
            
            // Delete other unverified duplicates if they exist
            if (users.size() > 1) {
                for (int i = 1; i < users.size(); i++) userRepository.delete(users.get(i));
            }
        } else {
            user = new UserAccount(
                    request.fullName().trim(),
                    email,
                    passwordEncoder.encode(request.password()),
                    UserRole.CUSTOMER,
                    StringUtils.hasText(request.utilityCompany()) ? new CompanyInfo(request.utilityCompany()) : null
            );
        }

        user.setBirthdate(request.birthdate());
        user.setAddress(request.address());
        user.setPhotoDataUrl(request.photoDataUrl());
        if (StringUtils.hasText(request.utilityCompany())) {
            user.setCompany(new CompanyInfo(request.utilityCompany()));
        }

        String emailOtp = generateOtp();
        user.setEmailOtp(emailOtp);
        user.setEmailOtpExpiresAt(otpExpiry());

        // Persist BEFORE dispatching the email: the OTP is now durable even if SMTP is slow, and the
        // request no longer depends on the mail server to have written the account.
        saveUser(user);
        EmailService.DispatchResult delivery = dispatchOtpEmail(user.getEmail(), user.getFullName(), emailOtp, "Signup verification");
        markOtpSent("signup", email);
        addHistory(user, !users.isEmpty() ? "SIGNUP_RETRY" : "SIGNUP_CREATED");

        return new SignupResponse(
                buildSignupMessage(delivery),
                delivery.definitelyFailed() && demoFallbackEnabled ? emailOtp : null
        );
    }

    public void verifyOtp(VerifyOtpRequest request) {
        UserAccount user = getUserByEmail(request.email());
        if (isExpired(user.getEmailOtpExpiresAt())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "That OTP has expired. Use Resend OTP to get a fresh code.");
        }
        if (!safeEquals(user.getEmailOtp(), request.emailOtp())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "That OTP is not correct. Please check the code and try again.");
        }
        user.setVerified(true);
        clearSignupOtps(user);
        saveUser(user);
        addHistory(user, "OTP_VERIFIED");
    }

    public MessageResponse resendSignupOtp(String email) {
        String normalized = normalizeEmail(email);
        UserAccount user = getUserByEmail(normalized);
        if (user.isVerified()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "This account is already verified. Please sign in.");
        }

        // Absorb duplicate clicks: if a still-valid OTP went out moments ago, hand back the same
        // answer instead of minting (and emailing) a second code.
        if (otpWasSentRecently("signup", normalized) && user.getEmailOtp() != null
                && !isExpired(user.getEmailOtpExpiresAt())) {
            return new MessageResponse("An OTP was sent moments ago — please check your inbox before requesting another.");
        }

        String otp = generateOtp();
        user.setEmailOtp(otp);
        user.setEmailOtpExpiresAt(otpExpiry());
        saveUser(user);

        EmailService.DispatchResult delivery = dispatchOtpEmail(user.getEmail(), user.getFullName(), otp, "Signup verification");
        markOtpSent("signup", normalized);
        addHistory(user, "SIGNUP_OTP_RESENT");

        if (delivery.definitelyFailed() && !demoFallbackEnabled) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Could not resend the OTP right now. Please try again in a moment.");
        }
        return new MessageResponse(describeDelivery(delivery, "OTP", otp, null));
    }

    public SendLoginOtpResponse sendLoginOtp(SendLoginOtpRequest request) {
        requireEmailChannel(request.channel());
        String normalized = normalizeEmail(request.target());
        UserAccount user = getUserByEmail(normalized);
        if (!user.isVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Please verify your email address before signing in.");
        }

        if (otpWasSentRecently("login", normalized) && user.getLoginOtp() != null
                && !isExpired(user.getLoginOtpExpiresAt())) {
            return new SendLoginOtpResponse(
                    "A login OTP was sent moments ago — please check your inbox before requesting another.", null);
        }

        String otp = generateOtp();
        user.setLoginOtp(otp);
        user.setLoginOtpExpiresAt(otpExpiry());
        saveUser(user);

        EmailService.DispatchResult delivery = dispatchOtpEmail(user.getEmail(), user.getFullName(), otp, "Login verification");

        if (delivery.definitelyFailed() && !demoFallbackEnabled) {
            clearLoginOtp(user);
            saveUser(user);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Could not send a login OTP right now. Please try again in a moment.");
        }
        markOtpSent("login", normalized);
        addHistory(user, "LOGIN_OTP_SENT");

        String demoOtp = delivery.definitelyFailed() && demoFallbackEnabled ? otp : null;
        return new SendLoginOtpResponse(describeDelivery(delivery, "OTP", otp, maskEmail(user.getEmail())), demoOtp);
    }

    public VerifyLoginOtpResponse verifyLoginOtp(VerifyLoginOtpRequest request) {
        requireEmailChannel(request.channel());
        UserAccount user = getUserByEmail(request.target());

        if (isExpired(user.getLoginOtpExpiresAt())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "That login OTP has expired. Please request a new code.");
        }
        if (!safeEquals(user.getLoginOtp(), request.otp())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "That login OTP is not correct. Please check the code and try again.");
        }

        clearLoginOtp(user);
        saveUser(user);
        addHistory(user, "LOGIN_OTP_VERIFIED");
        return new VerifyLoginOtpResponse("Login OTP verified. Enter your password to continue.", user.getEmail());
    }

    public LoginResponse login(LoginRequest request) {
        UserAccount user;
        try {
            user = getUserByEmail(request.email());
        } catch (ApiException ex) {
            // Same message as a wrong password: don't reveal whether the email is registered.
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Incorrect email or password.");
        }
        if (!user.isVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Please verify your email address first. Check your inbox for the OTP, or sign up again to receive a new one.");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Incorrect email or password.");
        }

        String token = UUID.randomUUID().toString();
        sessions.put(token, user.getId());
        addHistory(user, "LOGIN_SUCCESS");
        return new LoginResponse(token);
    }

    public ProfileResponse getProfile(String token) {
        UserAccount user = requireUser(token);
        return toProfileResponse(user);
    }

    public ProfileResponse updateProfile(String token, UpdateProfileRequest request) {
        UserAccount user = requireUser(token);
        if (request.fullName() != null) {
            user.setFullName(request.fullName().trim());
        }
        if (request.birthdate() != null) {
            user.setBirthdate(request.birthdate());
        }
        if (request.address() != null) {
            user.setAddress(request.address());
        }
        if (request.utilityCompany() != null) {
            user.setCompany(new CompanyInfo(request.utilityCompany()));
        }
        if (request.photoDataUrl() != null) {
            user.setPhotoDataUrl(request.photoDataUrl());
        }
        saveUser(user);
        addHistory(user, "PROFILE_UPDATED");
        return toProfileResponse(user);
    }

    public MessageResponse forgotPassword(String email) {
        UserAccount user;
        try {
            user = getUserByEmail(email);
        } catch (ApiException ex) {
            // Do not leak whether the email is registered.
            return new MessageResponse("If an account with that email exists, a password reset code has been sent.");
        }

        String otp = generateOtp();
        user.setResetPasswordOtp(otp);
        user.setResetPasswordOtpExpiresAt(otpExpiry());
        saveUser(user);

        EmailService.DispatchResult delivery = dispatchOtpEmail(user.getEmail(), user.getFullName(), otp, "Password reset");
        addHistory(user, "PASSWORD_RESET_REQUESTED");

        String generic = "If an account with that email exists, a password reset code has been sent.";
        if (delivery.confirmedSent()) {
            return new MessageResponse(generic);
        }
        if (delivery.accepted()) {
            return new MessageResponse("If an account with that email exists, a password reset code is on its way.");
        }
        if (demoFallbackEnabled) {
            return new MessageResponse(generic
                    + " (Live email delivery is not fully configured; demo OTP: " + otp + ")");
        }
        return new MessageResponse(generic);
    }

    public MessageResponse resetPassword(ResetPasswordRequest request) {
        requireValidPassword(request.newPassword(), "New password");
        UserAccount user = getUserByEmail(request.email());
        if (isExpired(user.getResetPasswordOtpExpiresAt())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "This reset code has expired. Please request a new one.");
        }
        if (!safeEquals(user.getResetPasswordOtp(), request.otp())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "That reset code is not valid. Please check and try again.");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setResetPasswordOtp(null);
        user.setResetPasswordOtpExpiresAt(null);
        saveUser(user);
        addHistory(user, "PASSWORD_RESET_COMPLETED");
        return new MessageResponse("Password reset successful. You can sign in now.");
    }

    private ProfileResponse toProfileResponse(UserAccount user) {
        return new ProfileResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole(),
                user.getCompany(),
                user.getBirthdate(),
                user.getAddress(),
                user.getPhotoDataUrl()
        );
    }

    public List<AdminUserResponse> listUsers(String token) {
        requireAdmin(token);
        return userRepository.findAll().stream()
                .sorted(Comparator.comparing(UserAccount::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(user -> new AdminUserResponse(
                        user.getId(),
                        user.getFullName(),
                        user.getEmail(),
                        user.getRole(),
                        user.getCompany(),
                        user.isVerified()
                ))
                .toList();
    }

    public List<HistoryRecord> getUserHistory(String token, String userId) {
        requireAdmin(token);
        return historyRepository.findByUserId(userId);
    }

    public byte[] exportUsersWorkbook(String token) {
        requireAdmin(token);

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Users");

            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);

            XSSFFont font = workbook.createFont();
            font.setBold(true);
            font.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(font);

            var header = sheet.createRow(0);
            String[] columns = {"Name", "Email", "Role", "Verified", "Company"};
            for (int i = 0; i < columns.length; i++) {
                var cell = header.createCell(i);
                cell.setCellValue(columns[i]);
                cell.setCellStyle(headerStyle);
            }

            List<AdminUserResponse> users = listUsers(token);
            for (int i = 0; i < users.size(); i++) {
                AdminUserResponse user = users.get(i);
                var row = sheet.createRow(i + 1);
                row.createCell(0).setCellValue(user.fullName());
                row.createCell(1).setCellValue(user.email());
                row.createCell(2).setCellValue(user.role().name());
                row.createCell(3).setCellValue(user.verified() ? "Yes" : "No");
                row.createCell(4).setCellValue(user.company() == null ? "" : user.company().name());
            }

            for (int i = 0; i < columns.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate Excel export.");
        }
    }

    public UserAccount requireAdmin(String token) {
        UserAccount user = requireUser(token);
        if (user.getRole() != UserRole.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Access denied. Admin credentials required.");
        }
        return user;
    }

    public UserAccount requireUser(String token) {
        if (token == null || token.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Missing session token.");
        }
        String userId = sessions.get(token);
        if (userId == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }
        UserAccount user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Session user no longer exists.");
        }
        return user;
    }

    private void saveUser(UserAccount user) {
        userRepository.save(user);
    }

    private void addHistory(UserAccount user, String action) {
        try {
            historyRepository.save(new HistoryRecord(
                    UUID.randomUUID().toString(),
                    new UserSummary(user.getId(), user.getFullName(), user.getEmail()),
                    action,
                    Instant.now()
            ));
        } catch (Exception e) {
            System.err.println("Warning: Could not save history record: " + e.getMessage());
        }
    }

    private UserAccount getUserByEmail(String email) {
        String normalized = normalizeEmail(email);
        List<UserAccount> users = userRepository.findAllByEmail(normalized);
        if (users.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "We couldn't find an account with that email address.");
        }
        if (users.size() > 1) {
            System.err.println("Warning: Found duplicate accounts for " + normalized + ". Using the first one.");
            // Optional: delete duplicates here if you want to be proactive
            // for (int i = 1; i < users.size(); i++) userRepository.delete(users.get(i));
        }
        return users.get(0);
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private String generateOtp() {
        return String.valueOf(100000 + (int) (Math.random() * 900000));
    }

    private Instant otpExpiry() {
        return Instant.now().plus(OTP_TTL_MINUTES, ChronoUnit.MINUTES);
    }

    private boolean isExpired(Instant expiry) {
        return expiry == null || Instant.now().isAfter(expiry);
    }

    private void clearSignupOtps(UserAccount user) {
        user.setEmailOtp(null);
        user.setEmailOtpExpiresAt(null);
    }

    private void clearLoginOtp(UserAccount user) {
        user.setLoginOtp(null);
        user.setLoginOtpExpiresAt(null);
    }

    private void requireEmailChannel(String channel) {
        if (channel == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Channel is required.");
        }
        String normalized = channel.trim().toLowerCase(Locale.ROOT);
        if (!normalized.equals("email")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only email login is supported.");
        }
    }

    private EmailService.DispatchResult dispatchOtpEmail(String email, String fullName, String otp, String purpose) {
        String subject = "EcoTrack OTP Verification";
        String body = "Hello " + fullName + ",\n\nYour EcoTrack " + purpose.toLowerCase(Locale.ROOT)
                + " OTP is " + otp + ". It will expire in " + OTP_TTL_MINUTES + " minutes.\n\n"
                + "If you did not request this, please ignore this message.";
        return emailService.dispatch(email, subject, body, mailConfirmWindow);
    }

    /**
     * Turns a delivery result into a user-facing sentence. Never claims the email was sent unless
     * SMTP actually confirmed it; "accepted" means it is still in flight.
     */
    private String describeDelivery(EmailService.DispatchResult delivery, String label, String otp, String recipient) {
        if (delivery.confirmedSent()) {
            return recipient == null
                    ? label + " sent successfully to your email."
                    : label + " sent to " + recipient + ". It expires in " + OTP_TTL_MINUTES + " minutes.";
        }
        if (delivery.accepted()) {
            return "Your " + label.toLowerCase(Locale.ROOT)
                    + " is on its way — it usually arrives within a minute. If it does not, you can request a new one.";
        }
        if (demoFallbackEnabled) {
            return "Live email delivery is unavailable right now, so a demo " + label + " is shown for testing: " + otp;
        }
        return "We could not send the " + label.toLowerCase(Locale.ROOT) + " right now. Please try again in a moment.";
    }

    private String buildSignupMessage(EmailService.DispatchResult delivery) {
        if (delivery.confirmedSent()) {
            return "Account created successfully. We sent a verification OTP to your email.";
        }
        if (delivery.accepted()) {
            return "Account created successfully. Your verification OTP is on its way — it usually arrives within a minute.";
        }
        if (demoFallbackEnabled) {
            return "Account created successfully. Live email delivery is unavailable right now, so a demo OTP is shown for testing.";
        }
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "We could not send the verification OTP. Please try again in a moment.");
    }

    private void requireValidPassword(String password, String fieldLabel) {
        String value = password == null ? "" : password;
        if (value.length() < MIN_PASSWORD_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    fieldLabel + " must contain at least " + MIN_PASSWORD_LENGTH + " characters.");
        }
        if (value.length() > MAX_PASSWORD_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    fieldLabel + " must be at most " + MAX_PASSWORD_LENGTH + " characters.");
        }
    }

    private String otpKey(String scope, String email) {
        return scope + ':' + email;
    }

    private void markOtpSent(String scope, String email) {
        otpSentAt.put(otpKey(scope, email), Instant.now());
    }

    private boolean otpWasSentRecently(String scope, String email) {
        Instant last = otpSentAt.get(otpKey(scope, email));
        return last != null && last.plusSeconds(OTP_RESEND_MIN_INTERVAL_SECONDS).isAfter(Instant.now());
    }

    private String maskEmail(String email) {
        int at = email == null ? -1 : email.indexOf('@');
        if (at <= 1) {
            return email;
        }
        return email.charAt(0) + "***" + email.substring(at);
    }

    private boolean safeEquals(String left, String right) {
        return left != null && left.equals(right == null ? "" : right.trim());
    }
}
