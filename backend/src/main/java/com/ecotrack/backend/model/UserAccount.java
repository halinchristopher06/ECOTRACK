package com.ecotrack.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "users")
public class UserAccount {
    @Id
    private String id;
    private String fullName;
    private String email;
    private String passwordHash;
    private UserRole role;
    private CompanyInfo company;
    private boolean verified;
    private String emailOtp;
    private Instant emailOtpExpiresAt;
    private String loginOtp;
    private Instant loginOtpExpiresAt;
    private String resetPasswordOtp;
    private Instant resetPasswordOtpExpiresAt;
    private String birthdate;
    private String address;
    // Note: storing the profile photo as a base64 data URL string is acceptable for this phase
    // since photos are small; if photo sizes grow, move this to object storage/GridFS in a
    // later media-handling phase.
    private String photoDataUrl;
    // Added in the admin-analytics phase so AdminAnalyticsService can report real signup
    // history instead of fabricating one. Nullable: accounts created before this field existed
    // simply have no createdAt and are excluded from any date-bucketed analytics.
    private Instant createdAt;

    public UserAccount() {}

    public UserAccount(String fullName, String email, String passwordHash, UserRole role, CompanyInfo company) {
        this.id = UUID.randomUUID().toString();
        this.fullName = fullName;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.company = company;
        this.verified = false;
        this.createdAt = Instant.now();
    }

    public void setId(String id) {
        this.id = id;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public void setCompany(CompanyInfo company) {
        this.company = company;
    }

    public String getId() {
        return id;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public UserRole getRole() {
        return role;
    }

    public CompanyInfo getCompany() {
        return company;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public String getEmailOtp() {
        return emailOtp;
    }

    public void setEmailOtp(String emailOtp) {
        this.emailOtp = emailOtp;
    }

    public Instant getEmailOtpExpiresAt() {
        return emailOtpExpiresAt;
    }

    public void setEmailOtpExpiresAt(Instant emailOtpExpiresAt) {
        this.emailOtpExpiresAt = emailOtpExpiresAt;
    }

    public String getLoginOtp() {
        return loginOtp;
    }

    public void setLoginOtp(String loginOtp) {
        this.loginOtp = loginOtp;
    }

    public Instant getLoginOtpExpiresAt() {
        return loginOtpExpiresAt;
    }

    public void setLoginOtpExpiresAt(Instant loginOtpExpiresAt) {
        this.loginOtpExpiresAt = loginOtpExpiresAt;
    }

    public String getResetPasswordOtp() {
        return resetPasswordOtp;
    }

    public void setResetPasswordOtp(String resetPasswordOtp) {
        this.resetPasswordOtp = resetPasswordOtp;
    }

    public Instant getResetPasswordOtpExpiresAt() {
        return resetPasswordOtpExpiresAt;
    }

    public void setResetPasswordOtpExpiresAt(Instant resetPasswordOtpExpiresAt) {
        this.resetPasswordOtpExpiresAt = resetPasswordOtpExpiresAt;
    }

    public String getBirthdate() {
        return birthdate;
    }

    public void setBirthdate(String birthdate) {
        this.birthdate = birthdate;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getPhotoDataUrl() {
        return photoDataUrl;
    }

    public void setPhotoDataUrl(String photoDataUrl) {
        this.photoDataUrl = photoDataUrl;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
