"use client";

import type { Project } from "@/api/projects";
import type { Team } from "@/api/team";
import { DynamicHeight } from "@/components/ui/DynamicHeight";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Account } from "@3rdweb-sdk/react/hooks/useApi";
import { ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";
import type { ThirdwebClient } from "thirdweb";
import { ProjectSelectorUI } from "./ProjectSelectorUI";
import { TeamSelectionUI } from "./TeamSelectionUI";

type TeamSwitcherProps = {
  currentTeam: Team | undefined;
  currentProject: Project | undefined;
  teamsAndProjects: Array<{ team: Team; projects: Project[] }>;
  focus: "project-selection" | "team-selection";
  createProject: (team: Team) => void;
  createTeam: () => void;
  account: Pick<Account, "email" | "id"> | undefined;
  client: ThirdwebClient;
};

export function TeamAndProjectSelectorPopoverButton(props: TeamSwitcherProps) {
  const [open, setOpen] = useState(false);
  const { currentTeam, teamsAndProjects } = props;
  const [hoveredTeam, setHoveredTeam] = useState<Team>();
  const projectsToShowOfTeam =
    hoveredTeam || currentTeam || teamsAndProjects[0]?.team;

  // if we can't find a single team associated with this user - something is really wrong
  if (!projectsToShowOfTeam) {
    return null;
  }

  const teamProjects = teamsAndProjects.find(
    (x) => x.team.slug === projectsToShowOfTeam.slug,
  )?.projects;

  // @TODO: HACK hide Engine projects from the list.
  const projectsToShow = teamProjects?.filter(
    (project) => !project.name.startsWith("Cloud-hosted Engine ("),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(_open) => {
        setOpen(_open);
        if (!_open) {
          setHoveredTeam(undefined);
        }
      }}
    >
      {/* Trigger */}
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className="!h-auto w-auto rounded-xl px-1 py-2"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label={`Select a ${props.focus === "project-selection" ? "project" : "team"}`}
        >
          <ChevronsUpDownIcon
            className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
            strokeWidth={1.5}
          />
        </Button>
      </PopoverTrigger>

      {/* Dropdown */}
      <PopoverContent
        sideOffset={5}
        className="w-auto rounded-xl p-0 shadow-xl"
        align={props.focus === "project-selection" ? "center" : "start"}
        onClick={(e) => {
          if (e.target instanceof HTMLAnchorElement) {
            setOpen(false);
          }
        }}
      >
        <DynamicHeight>
          <div className="no-scrollbar flex [&>div]:min-w-[280px]">
            {/* Left */}
            <TeamSelectionUI
              isOnProjectPage={!!props.currentProject}
              currentTeam={currentTeam}
              setHoveredTeam={setHoveredTeam}
              teamsAndProjects={teamsAndProjects}
              upgradeTeamLink={
                currentTeam
                  ? `/team/${currentTeam.slug}/~/settings/billing`
                  : undefined
              }
              account={props.account}
              client={props.client}
              createTeam={() => {
                setOpen(false);
                props.createTeam();
              }}
            />

            {/* Right */}
            {projectsToShow && (
              <ProjectSelectorUI
                currentProject={props.currentProject}
                projects={projectsToShow}
                team={projectsToShowOfTeam}
                client={props.client}
                createProject={() => {
                  setOpen(false);
                  props.createProject(projectsToShowOfTeam);
                }}
              />
            )}
          </div>
        </DynamicHeight>
      </PopoverContent>
    </Popover>
  );
}
