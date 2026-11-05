package com.ecotrack.backend.dto;

public record UpdateProfileRequest(
        String fullName,
        String birthdate,
        String address,
        String utilityCompany,
        String photoDataUrl
) {
}
