//go:build windows

package main

import "golang.org/x/sys/windows/svc"

type lsbService struct{}

func (s *lsbService) Execute(
	args []string,
	r <-chan svc.ChangeRequest,
	changes chan<- svc.Status,
) (bool, uint32) {
	changes <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}
	for {
		select {
		case change := <-r:
			switch change.Cmd {
			case svc.Stop, svc.Shutdown:
				changes <- svc.Status{State: svc.StopPending}
				return false, 0
			}
		}
	}
}

func RunAsService(serviceName string) error {
	return svc.Run(serviceName, &lsbService{})
}

func IsWindowsService() (bool, error) {
	return svc.IsWindowsService()
}
