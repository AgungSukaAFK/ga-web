"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PropsWithChildren } from "react";

// Define the props that the component will accept
interface ConfirmDialogProps extends PropsWithChildren {
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  triggerButtonText?: string;
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  confirmText = "Continue",
  cancelText = "Cancel",
  triggerButtonText = "Show Dialog",
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {/*
          'children' prop allows you to pass any component as a trigger.
          If no children are provided, it defaults to a <Button>.
        */}
        {children || <Button variant="outline">{triggerButtonText}</Button>}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          {/*
            The AlertDialogAction component will now execute the onConfirm function
            that is passed as a prop.
          */}
          <AlertDialogAction onClick={onConfirm}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
