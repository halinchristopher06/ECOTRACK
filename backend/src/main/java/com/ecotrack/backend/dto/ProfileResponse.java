package com.ecotrack.backend.dto;

import com.ecotrack.backend.model.CompanyInfo;
import com.ecotrack.backend.model.UserRole;

public record ProfileResponse(
        String id,
        String fullName,
        String email,
        UserRole role,
        CompanyInfo company,
        String birthdate,
        String address,
        String photoDataUrl
) {
}
