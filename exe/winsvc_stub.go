//go:build !windows

package main

func RunAsService(serviceName string) error {
	return nil
}

func IsWindowsService() (bool, error) {
	return false, nil
}
