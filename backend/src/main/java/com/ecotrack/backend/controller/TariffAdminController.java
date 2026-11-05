package com.ecotrack.backend.controller;

import com.ecotrack.backend.dto.CreateTariffRequest;
import com.ecotrack.backend.model.TariffConfig;
import com.ecotrack.backend.model.UtilityType;
import com.ecotrack.backend.service.TariffAdminService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/tariffs")
public class TariffAdminController {

    private final TariffAdminService tariffAdminService;

    public TariffAdminController(TariffAdminService tariffAdminService) {
        this.tariffAdminService = tariffAdminService;
    }

    @GetMapping
    public List<TariffConfig> listTariffs(
            @RequestHeader("X-Session-Token") String token,
            @RequestParam(required = false) UtilityType utilityType
    ) {
        return tariffAdminService.listTariffs(token, utilityType);
    }

    @PostMapping
    public TariffConfig createProvider(
            @RequestHeader("X-Session-Token") String token,
            @RequestBody CreateTariffRequest request
    ) {
        return tariffAdminService.createProvider(token, request);
    }

    @PostMapping("/new-version")
    public TariffConfig addRateVersion(
            @RequestHeader("X-Session-Token") String token,
            @RequestBody CreateTariffRequest request
    ) {
        return tariffAdminService.addRateVersion(token, request.groupKey(), request);
    }

    @PutMapping("/{id}/active")
    public TariffConfig setActive(
            @RequestHeader("X-Session-Token") String token,
            @PathVariable String id,
            @RequestParam boolean value
    ) {
        return tariffAdminService.setActive(token, id, value);
    }

    @GetMapping("/history")
    public List<TariffConfig> getHistory(
            @RequestHeader("X-Session-Token") String token,
            @RequestParam String groupKey
    ) {
        return tariffAdminService.getHistory(token, groupKey);
    }
}
