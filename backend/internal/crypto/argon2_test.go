package crypto

import (
	"testing"
)

func TestHashPassword(t *testing.T) {
	password := "testpassword123"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	// Check that hash is not empty
	if hash == "" {
		t.Fatal("HashPassword() returned empty hash")
	}

	// Check that hash contains the argon2id identifier
	if len(hash) < 10 || hash[:9] != "$argon2id" {
		t.Fatalf("HashPassword() hash does not start with $argon2id: %s", hash)
	}
}

func TestVerifyPassword_Success(t *testing.T) {
	password := "testpassword123"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	err = VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("VerifyPassword() error = %v", err)
	}
}

func TestVerifyPassword_WrongPassword(t *testing.T) {
	password := "testpassword123"
	wrongPassword := "wrongpassword"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	err = VerifyPassword(wrongPassword, hash)
	if err == nil {
		t.Fatal("VerifyPassword() expected error for wrong password, got nil")
	}
}

func TestVerifyPassword_InvalidHash(t *testing.T) {
	err := VerifyPassword("password", "invalid-hash")
	if err != ErrInvalidHash {
		t.Fatalf("VerifyPassword() error = %v, want ErrInvalidHash", err)
	}
}

func TestVerifyPassword_EmptyHash(t *testing.T) {
	err := VerifyPassword("password", "")
	if err != ErrInvalidHash {
		t.Fatalf("VerifyPassword() error = %v, want ErrInvalidHash", err)
	}
}

func TestHashPassword_DifferentSalts(t *testing.T) {
	password := "testpassword123"

	hash1, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	hash2, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	// Same password should produce different hashes (due to random salt)
	if hash1 == hash2 {
		t.Fatal("HashPassword() should produce different hashes for same password")
	}

	// Both hashes should verify correctly
	if err := VerifyPassword(password, hash1); err != nil {
		t.Fatalf("VerifyPassword() failed for hash1: %v", err)
	}
	if err := VerifyPassword(password, hash2); err != nil {
		t.Fatalf("VerifyPassword() failed for hash2: %v", err)
	}
}

func TestHashPassword_LongPassword(t *testing.T) {
	// Test with a very long password (argon2 has no length limit unlike bcrypt)
	password := ""
	for i := 0; i < 1000; i++ {
		password += "a"
	}

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v for long password", err)
	}

	err = VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("VerifyPassword() error = %v for long password", err)
	}
}

func TestHashPassword_UnicodePassword(t *testing.T) {
	// Test with unicode password
	password := "パスワード123"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v for unicode password", err)
	}

	err = VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("VerifyPassword() error = %v for unicode password", err)
	}
}

func TestHashPassword_EmptyPassword(t *testing.T) {
	// Empty password should still work (but not recommended)
	password := ""

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v for empty password", err)
	}

	err = VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("VerifyPassword() error = %v for empty password", err)
	}
}
