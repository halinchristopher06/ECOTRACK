package com.ecotrack.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "history")
public record HistoryRecord(@Id String id, UserSummary user, String action, Instant timestamp) {
}
