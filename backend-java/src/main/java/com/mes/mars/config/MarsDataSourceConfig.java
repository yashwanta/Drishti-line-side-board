package com.mes.mars.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

/**
 * Configures the SQL Server DataSource for the MARS database.
 *
 * Connection details are injected from application.properties (which read
 * from environment variables so credentials never live in source code).
 *
 * Required environment variables:
 *   MARS_DB_HOST   — SQL Server host (e.g. 192.168.1.100)
 *   MARS_DB_PORT   — port, typically 1433
 *   MARS_DB_NAME   — database name (e.g. MARS)
 *   MARS_DB_USER   — SQL auth username
 *   MARS_DB_PASS   — SQL auth password
 *
 * For Windows Authentication (SSPI), replace the JDBC URL in application.properties:
 *   jdbc:sqlserver://<HOST>:1433;databaseName=MARS;integratedSecurity=true
 * and place sqljdbc_auth.dll on the JVM path.
 */
@Configuration
public class MarsDataSourceConfig {

    @Value("${mars.datasource.url}")
    private String url;

    @Value("${mars.datasource.username}")
    private String username;

    @Value("${mars.datasource.password}")
    private String password;

    @Value("${mars.datasource.driver-class-name}")
    private String driverClassName;

    @Bean(name = "marsDataSource")
    public DataSource marsDataSource() {
        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(url);
        cfg.setUsername(username);
        cfg.setPassword(password);
        cfg.setDriverClassName(driverClassName);
        cfg.setPoolName("MARS-Pool");
        cfg.setMaximumPoolSize(5);
        cfg.setMinimumIdle(1);
        cfg.setConnectionTimeout(10_000);
        cfg.setIdleTimeout(300_000);
        cfg.setMaxLifetime(600_000);
        // Test query for SQL Server
        cfg.setConnectionTestQuery("SELECT 1");
        return new HikariDataSource(cfg);
    }

    @Bean(name = "marsJdbc")
    public JdbcTemplate marsJdbcTemplate() {
        return new JdbcTemplate(marsDataSource());
    }
}
