package validators

import (
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
)

// MaxBytes is a custom validator that checks if a string's byte length is <= the specified value
var MaxBytes validator.Func = func(fl validator.FieldLevel) bool {
	s := fl.Field().String()
	param := fl.Param()
	maxBytes := 0
	for i := 0; i < len(param); i++ {
		maxBytes = maxBytes*10 + int(param[i]-'0')
	}
	return len(s) <= maxBytes // len() returns byte count for strings
}

// RegisterCustomValidators registers custom validators with gin
func RegisterCustomValidators() error {
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		if err := v.RegisterValidation("maxbytes", MaxBytes); err != nil {
			return err
		}
	}
	return nil
}
