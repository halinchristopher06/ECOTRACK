package com.ecotrack.backend.controller;

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
import com.ecotrack.backend.dto.VerifyLoginOtpRequest;
import com.ecotrack.backend.dto.VerifyLoginOtpResponse;
import com.ecotrack.backend.dto.VerifyOtpRequest;
import com.ecotrack.backend.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public SignupResponse signup(@Valid @RequestBody SignupRequest request) {
        return authService.signup(request);
    }

    @PostMapping("/verify-otp")
    public MessageResponse verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        authService.verifyOtp(request);
        return new MessageResponse("OTP verification successful. You can log in now.");
    }

    @PostMapping("/resend-otp")
    public MessageResponse resendOtp(@RequestBody java.util.Map<String, String> payload) {
        String email = payload.get("email");
        return authService.resendSignupOtp(email);
    }

    @PostMapping("/login/send-otp")
    public SendLoginOtpResponse sendLoginOtp(@Valid @RequestBody SendLoginOtpRequest request) {
        return authService.sendLoginOtp(request);
    }

    @PostMapping("/login/verify-otp")
    public VerifyLoginOtpResponse verifyLoginOtp(@Valid @RequestBody VerifyLoginOtpRequest request) {
        return authService.verifyLoginOtp(request);
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/profile")
    public ProfileResponse profile(@RequestHeader("X-Session-Token") String token) {
        return authService.getProfile(token);
    }

    @PutMapping("/profile")
    public ProfileResponse updateProfile(
            @RequestHeader("X-Session-Token") String token,
            @RequestBody UpdateProfileRequest request
    ) {
        return authService.updateProfile(token, request);
    }

    @PostMapping("/forgot-password")
    public MessageResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return authService.forgotPassword(request.email());
    }

    @PostMapping("/reset-password")
    public MessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return authService.resetPassword(request);
    }
}
