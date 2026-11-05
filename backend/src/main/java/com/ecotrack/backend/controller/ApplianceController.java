package com.ecotrack.backend.controller;

import com.ecotrack.backend.dto.ApplianceBreakdownResponse;
import com.ecotrack.backend.dto.CreateApplianceRequest;
import com.ecotrack.backend.dto.UpdateApplianceRequest;
import com.ecotrack.backend.model.Appliance;
import com.ecotrack.backend.service.ApplianceService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/appliances")
public class ApplianceController {

    private final ApplianceService applianceService;

    public ApplianceController(ApplianceService applianceService) {
        this.applianceService = applianceService;
    }

    @PostMapping
    public Appliance create(@RequestHeader("X-Session-Token") String token, @Valid @RequestBody CreateApplianceRequest request) {
        return applianceService.create(token, request);
    }

    @GetMapping
    public List<Appliance> list(@RequestHeader("X-Session-Token") String token) {
        return applianceService.list(token);
    }

    @GetMapping("/breakdown")
    public ApplianceBreakdownResponse breakdown(@RequestHeader("X-Session-Token") String token) {
        return applianceService.getBreakdown(token);
    }

    @GetMapping("/{id}")
    public Appliance get(@RequestHeader("X-Session-Token") String token, @PathVariable String id) {
        return applianceService.get(token, id);
    }

    @PutMapping("/{id}")
    public Appliance update(
            @RequestHeader("X-Session-Token") String token,
            @PathVariable String id,
            @RequestBody UpdateApplianceRequest request
    ) {
        return applianceService.update(token, id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@RequestHeader("X-Session-Token") String token, @PathVariable String id) {
        applianceService.delete(token, id);
        return ResponseEntity.noContent().build();
    }
}
