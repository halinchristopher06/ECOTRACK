package com.ecotrack.backend.service;

import com.ecotrack.backend.exception.ApiException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final List<String> ALLOWED_EXTENSIONS = List.of("pdf", "jpg", "jpeg", "png");
    private static final long MAX_FILE_SIZE_BYTES = 10L * 1024 * 1024; // 10MB

    private final Path uploadsRoot;

    public FileStorageService(@Value("${app.uploads.dir:uploads/bills}") String uploadsDir) {
        this.uploadsRoot = Paths.get(uploadsDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(uploadsRoot);
        } catch (IOException e) {
            System.err.println("Warning: Could not create uploads directory: " + e.getMessage());
        }
    }

    public String getExtension(String originalFilename) {
        if (!StringUtils.hasText(originalFilename) || !originalFilename.contains(".")) {
            return "";
        }
        return originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    public void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A file is required.");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File is too large. Maximum allowed size is 10MB.");
        }
        String extension = getExtension(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Unsupported file type. Allowed formats: pdf, jpg, jpeg, png.");
        }
    }

    /**
     * Stores the file on local disk with a unique generated name and returns the relative path
     * (relative to the configured uploads directory) to persist on the Bill document.
     */
    public String store(MultipartFile file) {
        validate(file);
        String extension = getExtension(file.getOriginalFilename());
        String storedName = UUID.randomUUID() + (StringUtils.hasText(extension) ? "." + extension : "");
        Path target = uploadsRoot.resolve(storedName);
        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store uploaded file.");
        }
        return storedName;
    }

    public InputStream readAsStream(String relativePath) {
        return openStream(resolvePath(relativePath));
    }

    /**
     * Resolves a stored file name to an absolute path, rejecting anything that would escape the
     * uploads directory. Used to hand the file to OCR without writing a second copy to disk.
     */
    public Path resolvePath(String relativePath) {
        if (!StringUtils.hasText(relativePath)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid document path.");
        }
        Path target = uploadsRoot.resolve(relativePath).normalize();
        if (!target.startsWith(uploadsRoot)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid document path.");
        }
        if (!Files.exists(target)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Document file not found.");
        }
        return target;
    }

    private InputStream openStream(Path target) {
        try {
            return Files.newInputStream(target);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Document file not found.");
        }
    }

    public byte[] readAsBytes(String relativePath) {
        try {
            return Files.readAllBytes(resolvePath(relativePath));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Document file not found.");
        }
    }

    public void delete(String relativePath) {
        if (!StringUtils.hasText(relativePath)) {
            return;
        }
        try {
            Path target = uploadsRoot.resolve(relativePath).normalize();
            if (target.startsWith(uploadsRoot)) {
                Files.deleteIfExists(target);
            }
        } catch (IOException e) {
            System.err.println("Warning: Could not delete file " + relativePath + ": " + e.getMessage());
        }
    }

    /** Absolute path to the configured uploads root, exposed for diagnostics only. */
    public Path getUploadsRoot() {
        return uploadsRoot;
    }
}
