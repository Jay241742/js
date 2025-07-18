import type { Project } from "@/api/projects";
import type { Team } from "@/api/team";
import { GradientAvatar } from "@/components/blocks/Avatars/GradientAvatar";
import { ScrollShadow } from "@/components/ui/ScrollShadow/ScrollShadow";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Account } from "@3rdweb-sdk/react/hooks/useApi";
import { CirclePlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ThirdwebClient } from "thirdweb";
import { TeamPlanBadge } from "../../../components/TeamPlanBadge";
import { SearchInput } from "./SearchInput";
import { getValidTeamPlan } from "./getValidTeamPlan";
import { TeamVerifiedIcon } from "./team-verified-icon";

export function TeamSelectionUI(props: {
  setHoveredTeam: (team: Team | undefined) => void;
  currentTeam: Team | undefined;
  teamsAndProjects: Array<{ team: Team; projects: Project[] }>;
  upgradeTeamLink: string | undefined;
  account: Pick<Account, "email" | "id" | "image"> | undefined;
  client: ThirdwebClient;
  isOnProjectPage: boolean;
  createTeam: () => void;
}) {
  const { setHoveredTeam, currentTeam, teamsAndProjects } = props;
  const pathname = usePathname();
  const teamPlan = currentTeam ? getValidTeamPlan(currentTeam) : undefined;
  const teams = teamsAndProjects.map((x) => x.team);
  const [searchTeamTerm, setSearchTeamTerm] = useState("");
  const filteredTeams = searchTeamTerm
    ? teams.filter((team) =>
        team.name.toLowerCase().includes(searchTeamTerm.toLowerCase()),
      )
    : teams;

  return (
    <div className="flex flex-col">
      <SearchInput
        placeholder="Search Teams"
        value={searchTeamTerm}
        onValueChange={setSearchTeamTerm}
      />
      <Separator />
      <ScrollShadow
        scrollableClassName="max-h-[400px] lg:max-h-[600px]"
        className="grow"
      >
        <div className="flex flex-col p-2">
          <Button
            className={cn("w-full justify-start gap-2 px-2")}
            variant="ghost"
            onMouseEnter={() => setHoveredTeam(undefined)}
            asChild
          >
            <Link href="/account">
              <GradientAvatar
                src={props.account?.image || ""}
                className="size-4"
                id={props.account?.id}
                client={props.client}
              />
              My Account
            </Link>
          </Button>

          <h2 className="mx-2 mt-4 mb-2 font-medium text-muted-foreground text-xs">
            Teams
          </h2>

          <ul>
            {filteredTeams.map((team) => {
              const isSelected = team.id === currentTeam?.id;
              return (
                // biome-ignore lint/a11y/useKeyWithMouseEvents: <explanation>
                <li
                  key={team.id}
                  className="py-0.5"
                  onMouseOver={() => {
                    setHoveredTeam(team);
                  }}
                >
                  <Button
                    className={cn(
                      "!opacity-100 w-full justify-between gap-2 pl-2",
                      isSelected && "bg-accent",
                    )}
                    variant="ghost"
                    asChild
                  >
                    <Link
                      href={
                        currentTeam &&
                        !props.isOnProjectPage &&
                        pathname.startsWith("/team")
                          ? pathname.replace(
                              `/team/${currentTeam.slug}`,
                              `/team/${team.slug}`,
                            )
                          : `/team/${team.slug}`
                      }
                    >
                      <div className="flex items-center gap-2">
                        <GradientAvatar
                          src={team.image || ""}
                          className="size-4"
                          id={team.id}
                          client={props.client}
                        />

                        <span className="truncate"> {team.name} </span>
                        <TeamVerifiedIcon domain={team.verifiedDomain} />
                      </div>

                      <TeamPlanBadge
                        plan={team.billingPlan}
                        teamSlug={team.slug}
                      />
                    </Link>
                  </Button>
                </li>
              );
            })}

            <li className="py-0.5">
              <Button
                className="w-full justify-start gap-2 px-2"
                variant="ghost"
                onClick={props.createTeam}
              >
                <CirclePlusIcon className="size-4 text-link-foreground" />
                Create Team
              </Button>
            </li>
          </ul>
        </div>
      </ScrollShadow>
      {/* Bottom */}
      {teamPlan && teamPlan !== "pro" && props.upgradeTeamLink && (
        <div className="border-border border-t p-2">
          <Button
            asChild
            variant="primary"
            className="w-full"
            onMouseEnter={() => setHoveredTeam(undefined)}
          >
            <Link href={props.upgradeTeamLink}>Upgrade Team</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
