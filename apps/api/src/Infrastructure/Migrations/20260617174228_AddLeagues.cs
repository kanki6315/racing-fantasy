using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace EnduranceFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLeagues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "league",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    season_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    visibility = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    owner_registration_id = table.Column<long>(type: "bigint", nullable: false),
                    join_code = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_league", x => x.id);
                    table.ForeignKey(
                        name: "fk_league_registrations_owner_registration_id",
                        column: x => x.owner_registration_id,
                        principalTable: "registration",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_league_seasons_season_id",
                        column: x => x.season_id,
                        principalTable: "season",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "league_membership",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    league_id = table.Column<long>(type: "bigint", nullable: false),
                    registration_id = table.Column<long>(type: "bigint", nullable: false),
                    joined_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_league_membership", x => x.id);
                    table.ForeignKey(
                        name: "fk_league_membership_league_league_id",
                        column: x => x.league_id,
                        principalTable: "league",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_league_membership_registrations_registration_id",
                        column: x => x.registration_id,
                        principalTable: "registration",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_league_join_code",
                table: "league",
                column: "join_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_league_owner_registration_id",
                table: "league",
                column: "owner_registration_id");

            migrationBuilder.CreateIndex(
                name: "ix_league_season_id",
                table: "league",
                column: "season_id");

            migrationBuilder.CreateIndex(
                name: "ix_league_membership_league_id_registration_id",
                table: "league_membership",
                columns: new[] { "league_id", "registration_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_league_membership_registration_id",
                table: "league_membership",
                column: "registration_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "league_membership");

            migrationBuilder.DropTable(
                name: "league");
        }
    }
}
