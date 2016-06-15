CREATE TABLE accounts (
    account_id INT UNSIGNED AUTO_INCREMENT,
    name VARCHAR(50) DEFAULT NULL,
    email VARCHAR(30) NOT NULL,
    password VARCHAR(50) NOT NULL,
    PRIMARY KEY (account_id),
    UNIQUE (email)
);

CREATE TABLE contacts (
    contact_id INT UNSIGNED AUTO_INCREMENT,
    name VARCHAR(50) DEFAULT NULL,
    phone_number VARCHAR(30) NOT NULL,
    phone_code CHAR(5) NOT NULL,
    valid BOOL DEFAULT TRUE,
    status CHAR(10) DEFAULT "UNRESOLVED",
    PRIMARY KEY (contact_id),
    UNIQUE (phone_number)
);

CREATE TABLE channels (
    channel_id INT UNSIGNED AUTO_INCREMENT,
    phone_number VARCHAR(30) NOT NULL,
    phone_code CHAR(5) NOT NULL,
    secret VARCHAR(50) NOT NULL,
    valid BOOL DEFAULT TRUE,
    operation_type CHAR(10) DEFAULT NULL,
    used_contacts_amount MEDIUMINT DEFAULT 0,
    PRIMARY KEY (channel_id),
    UNIQUE (phone_number)
);

CREATE TABLE campaigns (
    campaign_id INT UNSIGNED AUTO_INCREMENT,
    name VARCHAR(50) DEFAULT NULL,
    account_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (campaign_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE operational_contacts (
    campaign_id INT UNSIGNED NOT NULL,
    contact_id INT UNSIGNED NOT NULL,
    channel_id INT UNSIGNED DEFAULT NULL,
    targeted BOOL DEFAULT FALSE,
    ignored BOOL DEFAULT FALSE,
    PRIMARY KEY (campaign_id, contact_id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);


