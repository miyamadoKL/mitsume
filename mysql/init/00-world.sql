CREATE DATABASE IF NOT EXISTS world;
USE world;

CREATE TABLE IF NOT EXISTS country (
  Code CHAR(3) PRIMARY KEY,
  Name VARCHAR(52) NOT NULL,
  Continent VARCHAR(30) NOT NULL,
  Region VARCHAR(30) NOT NULL,
  Population INT NOT NULL
);

CREATE TABLE IF NOT EXISTS city (
  ID INT PRIMARY KEY AUTO_INCREMENT,
  Name VARCHAR(35) NOT NULL,
  CountryCode CHAR(3) NOT NULL,
  District VARCHAR(20) NOT NULL,
  Population INT NOT NULL,
  CONSTRAINT fk_city_country FOREIGN KEY (CountryCode) REFERENCES country(Code)
);

INSERT INTO country (Code, Name, Continent, Region, Population) VALUES
  ('JPN', 'Japan', 'Asia', 'Eastern Asia', 125700000),
  ('USA', 'United States', 'North America', 'Northern America', 331000000),
  ('CHN', 'China', 'Asia', 'Eastern Asia', 1402000000),
  ('IND', 'India', 'Asia', 'Southern Asia', 1428000000),
  ('BRA', 'Brazil', 'South America', 'South America', 214000000),
  ('FRA', 'France', 'Europe', 'Western Europe', 68000000);

INSERT INTO city (Name, CountryCode, District, Population) VALUES
  ('Tokyo', 'JPN', 'Tokyo-to', 13960000),
  ('Yokohama', 'JPN', 'Kanagawa', 3770000),
  ('Osaka', 'JPN', 'Osaka', 2750000),
  ('New York', 'USA', 'New York', 8336817),
  ('Los Angeles', 'USA', 'California', 3979576),
  ('Chicago', 'USA', 'Illinois', 2695598),
  ('Shanghai', 'CHN', 'Shanghai', 24183300),
  ('Beijing', 'CHN', 'Beijing', 21540000),
  ('Mumbai', 'IND', 'Maharashtra', 12478447),
  ('Delhi', 'IND', 'Delhi', 11034555),
  ('Sao Paulo', 'BRA', 'Sao Paulo', 12252023),
  ('Rio de Janeiro', 'BRA', 'Rio de Janeiro', 6747815),
  ('Paris', 'FRA', 'Ile-de-France', 2148327);

