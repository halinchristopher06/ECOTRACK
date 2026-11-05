package com.ecotrack.backend.controller;

import com.ecotrack.backend.dto.UpdateNotificationPreferenceRequest;
import com.ecotrack.backend.model.Notification;
import com.ecotrack.backend.model.NotificationPreference;
import com.ecotrack.backend.service.NotificationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<Notification> listNotifications(@RequestHeader("X-Session-Token") String token) {
        return notificationService.listNotifications(token);
    }

    @PutMapping("/{id}/read")
    public Notification markRead(
            @RequestHeader("X-Session-Token") String token,
            @PathVariable String id,
            @RequestParam("value") boolean value
    ) {
        return notificationService.markRead(token, id, value);
    }

    @GetMapping("/preferences")
    public NotificationPreference getPreferences(@RequestHeader("X-Session-Token") String token) {
        return notificationService.getPreferences(token);
    }

    @PutMapping("/preferences")
    public NotificationPreference updatePreferences(
            @RequestHeader("X-Session-Token") String token,
            @RequestBody UpdateNotificationPreferenceRequest request
    ) {
        return notificationService.updatePreferences(token, request);
    }
}
