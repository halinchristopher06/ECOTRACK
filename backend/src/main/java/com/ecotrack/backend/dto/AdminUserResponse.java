package com.ecotrack.backend.dto;

import com.ecotrack.backend.model.CompanyInfo;
import com.ecotrack.backend.model.UserRole;

public record AdminUserResponse(
        String id,
        String fullName,
        String email,
        UserRole role,
        CompanyInfo company,
        boolean verified
) {
}
