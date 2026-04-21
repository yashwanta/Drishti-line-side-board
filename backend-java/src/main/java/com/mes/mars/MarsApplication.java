package com.mes.mars;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * MES Mars Service — Spring Boot 3
 *
 * Responsibilities:
 *   1. Expose MARS SQL Server production/quality/schedule data via REST (port 8080)
 *   2. Poll the robot air press pendant (HTTP/REST) on a configurable interval
 *      and cache the latest reading in memory for the Go gateway to query
 *
 * The Go API gateway proxies /api/mars/* and /api/robotpress to this service.
 */
@SpringBootApplication
@EnableScheduling
public class MarsApplication {

    public static void main(String[] args) {
        SpringApplication.run(MarsApplication.class, args);
    }
}
