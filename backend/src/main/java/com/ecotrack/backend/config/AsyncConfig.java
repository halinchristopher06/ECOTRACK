package com.ecotrack.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Bounded thread pool used to dispatch outbound email off the request thread.
 *
 * <p>SMTP delivery is a network round-trip (DNS + TCP + STARTTLS + AUTH + DATA) that regularly
 * takes seconds on Gmail. Running it inline made every OTP request as slow as the mail server.
 * A small dedicated pool keeps that work off the Tomcat request threads while still bounding
 * resource use.
 */
@Configuration
public class AsyncConfig {

    @Bean(name = "mailTaskExecutor")
    public Executor mailTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("ecotrack-mail-");
        // Let queued/in-flight OTP emails finish on a normal shutdown instead of dropping them.
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(5);
        executor.initialize();
        return executor;
    }
}
