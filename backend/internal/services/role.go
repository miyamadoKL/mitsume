package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
)

var (
	ErrRoleNotFound       = errors.New("role not found")
	ErrCannotDeleteSystem = errors.New("cannot delete system role")
	ErrCannotModifySystem = errors.New("cannot modify system role")
	ErrDuplicateRoleName  = errors.New("role with this name already exists")
	ErrUnauthorized       = errors.New("unauthorized: admin access required")
	ErrCannotSelfDemote   = errors.New("cannot remove your own admin role")
	ErrUserNotFound       = errors.New("user not found")
	ErrCannotDisableSelf  = errors.New("cannot disable your own account")
)

type RoleService struct {
	roleRepo repository.RoleRepository
	userRepo repository.UserRepository
}

func NewRoleService(roleRepo repository.RoleRepository, userRepo repository.UserRepository) *RoleService {
	return &RoleService{
		roleRepo: roleRepo,
		userRepo: userRepo,
	}
}

// Role CRUD operations

func (s *RoleService) GetAllRoles(ctx context.Context) ([]models.RoleWithCatalogs, error) {
	roles, err := s.roleRepo.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]models.RoleWithCatalogs, len(roles))
	for i, role := range roles {
		catalogs, err := s.roleRepo.GetRoleCatalogs(ctx, role.ID)
		if err != nil {
			return nil, err
		}
		result[i] = models.RoleWithCatalogs{
			Role:     role,
			Catalogs: catalogs,
		}
	}
	return result, nil
}

func (s *RoleService) GetRole(ctx context.Context, roleID uuid.UUID) (*models.RoleWithCatalogs, error) {
	role, err := s.roleRepo.GetByID(ctx, roleID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrRoleNotFound
		}
		return nil, err
	}

	catalogs, err := s.roleRepo.GetRoleCatalogs(ctx, roleID)
	if err != nil {
		return nil, err
	}

	return &models.RoleWithCatalogs{
		Role:     *role,
		Catalogs: catalogs,
	}, nil
}

func (s *RoleService) CreateRole(ctx context.Context, adminUserID uuid.UUID, req *models.CreateRoleRequest) (*models.Role, error) {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, ErrUnauthorized
	}

	// Check if role name already exists
	existing, err := s.roleRepo.GetByName(ctx, req.Name)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}
	if existing != nil {
		return nil, ErrDuplicateRoleName
	}

	return s.roleRepo.Create(ctx, req.Name, req.Description)
}

func (s *RoleService) UpdateRole(ctx context.Context, adminUserID, roleID uuid.UUID, req *models.UpdateRoleRequest) (*models.Role, error) {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, ErrUnauthorized
	}

	// Check if role exists and is not system
	role, err := s.roleRepo.GetByID(ctx, roleID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrRoleNotFound
		}
		return nil, err
	}

	if role.IsSystem {
		return nil, ErrCannotModifySystem
	}

	// Check if new name conflicts with existing role
	if req.Name != "" && req.Name != role.Name {
		existing, err := s.roleRepo.GetByName(ctx, req.Name)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
		if existing != nil {
			return nil, ErrDuplicateRoleName
		}
	}

	name := req.Name
	if name == "" {
		name = role.Name
	}

	return s.roleRepo.Update(ctx, roleID, name, req.Description)
}

func (s *RoleService) DeleteRole(ctx context.Context, adminUserID, roleID uuid.UUID) error {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return ErrUnauthorized
	}

	// Check if role exists and is not system
	role, err := s.roleRepo.GetByID(ctx, roleID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrRoleNotFound
		}
		return err
	}

	if role.IsSystem {
		return ErrCannotDeleteSystem
	}

	return s.roleRepo.Delete(ctx, roleID)
}

// Catalog permissions

func (s *RoleService) SetRoleCatalogs(ctx context.Context, adminUserID, roleID uuid.UUID, catalogs []string) error {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return ErrUnauthorized
	}

	// Check if role exists
	_, err = s.roleRepo.GetByID(ctx, roleID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrRoleNotFound
		}
		return err
	}

	return s.roleRepo.SetRoleCatalogs(ctx, roleID, catalogs)
}

// User-Role assignments

func (s *RoleService) AssignRoleToUser(ctx context.Context, adminUserID, targetUserID, roleID uuid.UUID) error {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return ErrUnauthorized
	}

	// Check if role exists
	_, err = s.roleRepo.GetByID(ctx, roleID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrRoleNotFound
		}
		return err
	}

	return s.roleRepo.AssignRole(ctx, targetUserID, roleID, &adminUserID)
}

func (s *RoleService) UnassignRoleFromUser(ctx context.Context, adminUserID, targetUserID, roleID uuid.UUID) error {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return ErrUnauthorized
	}

	// Get admin role
	adminRole, err := s.roleRepo.GetAdminRole(ctx)
	if err != nil {
		return err
	}

	// Prevent self-demotion from admin
	if adminUserID == targetUserID && roleID == adminRole.ID {
		return ErrCannotSelfDemote
	}

	return s.roleRepo.UnassignRole(ctx, targetUserID, roleID)
}

func (s *RoleService) GetUsersWithRoles(ctx context.Context, adminUserID uuid.UUID) ([]models.UserWithRoles, error) {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, ErrUnauthorized
	}

	return s.roleRepo.GetAllUsersWithRoles(ctx)
}

// Permission checks

func (s *RoleService) IsAdmin(ctx context.Context, userID uuid.UUID) (bool, error) {
	return s.roleRepo.IsUserAdmin(ctx, userID)
}

func (s *RoleService) GetUserAllowedCatalogs(ctx context.Context, userID uuid.UUID) ([]string, error) {
	return s.roleRepo.GetUserAllowedCatalogs(ctx, userID)
}

func (s *RoleService) CanUserAccessCatalog(ctx context.Context, userID uuid.UUID, catalog string) (bool, error) {
	// Check if admin (admin has access to all catalogs)
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, userID)
	if err != nil {
		return false, err
	}
	if isAdmin {
		return true, nil
	}

	// Get user's allowed catalogs
	allowedCatalogs, err := s.roleRepo.GetUserAllowedCatalogs(ctx, userID)
	if err != nil {
		return false, err
	}

	// Check if catalog is in the allowed list
	for _, allowed := range allowedCatalogs {
		if allowed == catalog {
			return true, nil
		}
	}
	return false, nil
}

// GetUserRoles returns the roles for a specific user
func (s *RoleService) GetUserRoles(ctx context.Context, userID uuid.UUID) ([]models.Role, error) {
	return s.roleRepo.GetUserRoles(ctx, userID)
}

// User approval management

// GetPendingUsers returns all users with pending status
func (s *RoleService) GetPendingUsers(ctx context.Context, adminUserID uuid.UUID) ([]models.User, error) {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, ErrUnauthorized
	}

	return s.userRepo.GetAllByStatus(ctx, models.UserStatusPending)
}

// GetAllUsers returns all users
func (s *RoleService) GetAllUsers(ctx context.Context, adminUserID uuid.UUID) ([]models.User, error) {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, ErrUnauthorized
	}

	return s.userRepo.GetAll(ctx)
}

// ApproveUser approves a pending user
func (s *RoleService) ApproveUser(ctx context.Context, adminUserID, targetUserID uuid.UUID) error {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return ErrUnauthorized
	}

	// Check if user exists
	user, err := s.userRepo.FindByID(ctx, targetUserID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrUserNotFound
		}
		return err
	}

	// Can only approve pending users
	if user.Status != models.UserStatusPending {
		return errors.New("user is not pending approval")
	}

	return s.userRepo.UpdateStatus(ctx, targetUserID, models.UserStatusActive, &adminUserID)
}

// DisableUser disables a user account
func (s *RoleService) DisableUser(ctx context.Context, adminUserID, targetUserID uuid.UUID) error {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return ErrUnauthorized
	}

	// Cannot disable self
	if adminUserID == targetUserID {
		return ErrCannotDisableSelf
	}

	// Check if user exists
	_, err = s.userRepo.FindByID(ctx, targetUserID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrUserNotFound
		}
		return err
	}

	return s.userRepo.UpdateStatus(ctx, targetUserID, models.UserStatusDisabled, nil)
}

// EnableUser enables a disabled user account
func (s *RoleService) EnableUser(ctx context.Context, adminUserID, targetUserID uuid.UUID) error {
	// Check if admin
	isAdmin, err := s.roleRepo.IsUserAdmin(ctx, adminUserID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return ErrUnauthorized
	}

	// Check if user exists
	user, err := s.userRepo.FindByID(ctx, targetUserID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrUserNotFound
		}
		return err
	}

	// Can only enable disabled users
	if user.Status != models.UserStatusDisabled {
		return errors.New("user is not disabled")
	}

	return s.userRepo.UpdateStatus(ctx, targetUserID, models.UserStatusActive, &adminUserID)
}
