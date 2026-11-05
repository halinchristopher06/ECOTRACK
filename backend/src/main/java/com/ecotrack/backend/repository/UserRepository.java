package com.ecotrack.backend.repository;

import com.ecotrack.backend.model.UserAccount;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<UserAccount, String> {
    List<UserAccount> findAllByEmail(String email);
    Optional<UserAccount> findByEmail(String email);
}
