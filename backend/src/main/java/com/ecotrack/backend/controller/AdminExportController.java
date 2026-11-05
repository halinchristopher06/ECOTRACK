package com.ecotrack.backend.controller;

import com.ecotrack.backend.service.AuthService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminExportController {

    private final AuthService authService;

    public AdminExportController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/export-users")
    public ResponseEntity<byte[]> exportUsers(@RequestHeader("X-Session-Token") String token) {
        byte[] file = authService.exportUsersWorkbook(token);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("ecotrack_users_report.xlsx")
                        .build()
                        .toString())
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(file);
    }
}
